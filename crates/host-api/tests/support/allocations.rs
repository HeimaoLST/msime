use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

struct Counting;

thread_local! {
    // const 初始化、没有析构：读写它本身不会分配，也不会在分配器里递归。
    static ALLOCATIONS: Cell<usize> = const { Cell::new(0) };
    static BYTES: Cell<usize> = const { Cell::new(0) };
}

fn note(size: usize) {
    // 线程正在销毁时 thread_local 已不可用，那时的分配不属于任何一次测量。
    let _ = ALLOCATIONS.try_with(|count| count.set(count.get().wrapping_add(1)));
    let _ = BYTES.try_with(|bytes| bytes.set(bytes.get().wrapping_add(size)));
}

// 安全：每次调用原样转给系统分配器；计数只碰当前线程的整数。
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        note(layout.size());
        unsafe { System.alloc(layout) }
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        note(layout.size());
        unsafe { System.alloc_zeroed(layout) }
    }
    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        note(size);
        unsafe { System.realloc(pointer, layout, size) }
    }
    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        unsafe { System.dealloc(pointer, layout) }
    }
}

#[global_allocator]
static GLOBAL: Counting = Counting;

/// `operation` 在当前线程上分配了几次。
pub fn allocations(operation: impl FnOnce()) -> usize {
    allocation_requests(operation).0
}

/// 统计当前线程的申请次数和累计请求字节，不测 RSS。
pub fn allocation_requests(operation: impl FnOnce()) -> (usize, usize) {
    let before_count = ALLOCATIONS.with(Cell::get);
    let before_bytes = BYTES.with(Cell::get);
    operation();
    (
        ALLOCATIONS.with(Cell::get).wrapping_sub(before_count),
        BYTES.with(Cell::get).wrapping_sub(before_bytes),
    )
}
