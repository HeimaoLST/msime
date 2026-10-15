//! 预热后的共享繁简转换只申请输出缓冲，不为每个查找端点申请堆内存。
#![allow(unsafe_code)]

#[path = "support/allocations.rs"]
mod allocation_counter;

use allocation_counter::{allocation_requests, allocations};
use msime_client_core::chinese_conversion::{
    convert_to_traditional, simplified_to_traditional, traditional_to_simplified_characters,
    TraditionalVariant,
};

#[test]
fn chinese_conversion_does_not_allocate_for_each_prefix() {
    assert!(allocations(|| drop(std::hint::black_box(Vec::<u8>::with_capacity(8)))) > 0);
    // 字典和逆表首次构建不属于稳态转换预算。
    drop(simplified_to_traditional("汉语输入法"));
    drop(traditional_to_simplified_characters("漢語輸入法"));
    drop(convert_to_traditional(
        "汉语输入法",
        TraditionalVariant::TaiwanPhrases,
    ));
    let ascii = "synthetic-001 ".repeat(256);
    let cases = [
        ("", "", "", 0, 0),
        ("synthetic-001", "synthetic-001", "synthetic-001", 1, 1),
        ("汉语输入法", "漢語輸入法", "汉语输入法", 1, 1),
        ("发展头发", "發展頭髮", "发展头发", 1, 1),
        ("兀", "兀", "兀", 1, 2),
        ("a漢😀𠀀かな", "a漢😀𠀀かな", "a汉😀𠀀かな", 1, 1),
        ("⿰发发", "⿰发发", "⿰发发", 1, 1),
        ("⿰發發", "⿰發發", "⿰发发", 1, 1),
        (
            "PN结 SQL注入攻击",
            "PN結 SQL注入攻擊",
            "PN结 SQL注入攻击",
            1,
            1,
        ),
        (ascii.as_str(), ascii.as_str(), ascii.as_str(), 1, 1),
    ];
    let mut measurements = Vec::new();
    for (input, traditional, simplified, s2t_budget, inverse_budget) in cases {
        for (direction, convert, expected, budget) in [
            (
                "s2t",
                simplified_to_traditional as fn(&str) -> String,
                traditional,
                s2t_budget,
            ),
            (
                "t2s-char",
                traditional_to_simplified_characters as fn(&str) -> String,
                simplified,
                inverse_budget,
            ),
        ] {
            let mut output = String::new();
            let measured = allocation_requests(|| output = convert(std::hint::black_box(input)));
            assert_eq!(output, expected, "direction={direction}");
            eprintln!(
                "direction={direction} characters={} allocations={} requested_bytes={}",
                input.chars().count(),
                measured.0,
                measured.1
            );
            measurements.push((direction, input.chars().count(), measured, budget));
        }
    }
    // 所选文字不会使输出扩容；未变化的中间扫描借用原文，兼容字逆转换仍需两个缓冲。
    assert!(
        measurements
            .iter()
            .all(|(_, _, measured, budget)| measured.0 <= *budget),
        "未变化的扫描不应复制完整输入: {measurements:?}"
    );
}

#[test]
fn taiwan_conversion_allocates_a_fixed_number_of_buffers() {
    // 词表首次构建不属于稳态转换预算。
    drop(convert_to_traditional(
        "汉语输入法",
        TraditionalVariant::TaiwanPhrases,
    ));
    let long = "软件里面的鼠标和打印机，".repeat(64);
    for (input, variant) in [
        ("软件里面", TraditionalVariant::Taiwan),
        ("软件里面", TraditionalVariant::TaiwanPhrases),
        (long.as_str(), TraditionalVariant::TaiwanPhrases),
    ] {
        let mut output = String::new();
        let measured = allocation_requests(|| {
            output = convert_to_traditional(std::hint::black_box(input), variant)
        });
        assert!(!output.is_empty());
        // 规范化不改写时借用原文；之后只有输出和逐段暂存区两块缓冲，与分段数无关。
        assert!(
            measured.0 <= 2,
            "{variant:?} {} {measured:?}",
            input.chars().count()
        );
    }
}
