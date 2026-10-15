//! 未命中的离线释义不构造随即丢弃的 JSON 行，预算通过真实 C ABI 测量。
#![allow(unsafe_code)]

#[path = "support/allocations.rs"]
mod allocation_counter;

use allocation_counter::{allocation_requests, allocations};
use msime_host_api::{msime_client_candidate_gloss_request, msime_client_string_free};
use serde_json::{json, Value};
use std::ffi::{c_char, CStr};

fn request(rows: usize) -> Vec<u8> {
    serde_json::to_vec(&json!({
        "generation": 7,
        "target_language": "fr",
        "candidates": (0..rows).map(|index| json!({
            "text": format!("synthetic-{index:04}"), "source": 0
        })).collect::<Vec<_>>()
    }))
    .unwrap()
}

fn call(request: &[u8], resources: &[u8]) -> *mut c_char {
    // 安全：两份合成缓冲区在同步调用期间有效。
    unsafe {
        msime_client_candidate_gloss_request(
            request.as_ptr(),
            request.len(),
            resources.as_ptr(),
            resources.len(),
        )
    }
}

fn read_response(pointer: *mut c_char) -> Value {
    assert!(!pointer.is_null());
    // 安全：指针由本次 C ABI 调用返回，解析后释放一次。
    unsafe {
        let response = serde_json::from_slice(CStr::from_ptr(pointer).to_bytes()).unwrap();
        msime_client_string_free(pointer);
        response
    }
}

#[test]
fn offline_gloss_misses_only_pay_for_the_request_and_empty_reply() {
    assert!(allocations(|| drop(std::hint::black_box(Vec::<u8>::with_capacity(8)))) > 0);
    let sanity = allocation_requests(|| drop(std::hint::black_box(Vec::<u8>::with_capacity(37))));
    assert!(sanity.0 > 0 && sanity.1 >= 37);
    let directory = tempfile::tempdir().unwrap();
    let resources = directory.path().to_str().unwrap().as_bytes();
    // 法语词典没有安装，预热实际路径和字形转换的首次初始化。
    assert_eq!(read_response(call(&request(32), resources))["ok"], true);
    let empty = request(0);
    let mut pointer = std::ptr::null_mut();
    let baseline = allocation_requests(|| pointer = call(&empty, resources));
    assert_eq!(
        read_response(pointer),
        json!({"ok":true,"value":{"generation":7,"translations":[]}})
    );
    let mut measurements = Vec::new();
    for rows in [1, 8, 32, 1024, 4096] {
        let request = request(rows);
        // 用相同合成文字单独计数字形转换，让 JSON 预算独立于转换成本。
        let texts: Vec<String> = (0..rows)
            .map(|index| format!("synthetic-{index:04}"))
            .collect();
        let conversion = allocation_requests(|| {
            for text in &texts {
                std::hint::black_box(
                    msime_client_core::chinese_conversion::traditional_to_simplified_characters(
                        text,
                    ),
                );
            }
        });
        let mut pointer = std::ptr::null_mut();
        let measured = allocation_requests(|| pointer = call(&request, resources));
        assert_eq!(
            read_response(pointer),
            json!({"ok":true,"value":{"generation":7,"translations":[]}})
        );
        eprintln!(
            "rows={rows}: allocations={} requested_bytes={} empty_baseline={baseline:?} conversion={conversion:?}",
            measured.0, measured.1
        );
        measurements.push((rows, measured, conversion));
    }
    // 排除同文转换后，每行只允许输入字符串及容器增长的申请；固定开销留出余量。
    assert!(
        measurements.iter().all(|(rows, measured, conversion)| {
            measured.0 <= baseline.0 + conversion.0 + rows + 20
                && measured.1 <= baseline.1 + conversion.1 + rows * 192 + 8192
        }),
        "未命中不应承担逐行 JSON 构造: baseline={baseline:?} cases={measurements:?}"
    );
}
