//! `replace_online_candidate_batch` (core-session.md §7.2, quanpin.md §13, overlays.md §7.2).

use std::collections::HashSet;

use crate::types::{CandidateSource, WordItem};

pub const AI_QUOTA: usize = 10;
pub const CLOUD_QUOTA: usize = 1;
/// AI 座位的下标：首选和云候选之后（列表更短时落在末尾）。
pub const AI_SEAT: usize = 2;
/// AI 请求还没回答时占位行的文字。
pub const AI_PENDING_TEXT: &str = "…";
/// AI 回答为空或失败后占位行的文字，留到组字变化为止。
pub const AI_UNAVAILABLE_TEXT: &str = "—";
pub const MAX_ONLINE_WORD_BYTES: usize = 4_096;
const EXISTING_WORD_LINEAR_SCAN_LIMIT: usize = 64;

/// Validate a provider batch without constructing rows that a caller may immediately discard.
pub(crate) fn validate_online_candidate_batch(words: &[String], source: CandidateSource) -> bool {
    let quota = match source {
        CandidateSource::AiSuggestion => AI_QUOTA,
        CandidateSource::CloudSuggestion => CLOUD_QUOTA,
        _ => return false,
    };
    if words.is_empty() {
        return false;
    }
    if words.iter().any(|word| !is_acceptable_online_word(word)) {
        return false;
    }
    unique_online_words(words, quota).is_some()
}

/// 校验、去重、限额，去掉同一来源之前的行后插入，已在列表里的词跳过。云候选插在第 1 位；AI 批次的第一条坐 AI 座位（第 2 位，替换占位行），其余排在列表末尾，到达时不挪动已经显示的行（#6888）。云候选插入后 AI 座位上的那一行回到第 2 位。返回 false 时 `list` 不变。
pub fn replace_online_candidate_batch(
    list: &mut Vec<WordItem>,
    key: &str,
    words: &[String],
    source: CandidateSource,
) -> bool {
    let quota = match source {
        CandidateSource::AiSuggestion => AI_QUOTA,
        CandidateSource::CloudSuggestion => CLOUD_QUOTA,
        _ => return false,
    };
    if words.is_empty() {
        return false;
    }
    if words.iter().any(|word| !is_acceptable_online_word(word)) {
        return false;
    }
    // 在线候选的协议配额最多为 10 个，固定数组可避免每批次的临时堆分配。
    let Some((mut unique, unique_count)) = unique_online_words(words, quota) else {
        return false;
    };
    // Providers repeat candidates, so the quota counts distinct words: a repeat must neither reject a valid batch nor use up a seat (online_candidate_batch.h:32-33).

    if source == CandidateSource::AiSuggestion {
        // 新的 AI 批次连同占位行一起替换掉之前的 AI 行。
        list.retain(|item| !item.source.holds_ai_seat());
    } else {
        list.retain(|item| item.source != source);
    }
    let new_count = mark_existing_online_words(list, &mut unique, unique_count);
    list.reserve(new_count);
    let mut words = unique.into_iter().flatten();
    if source == CandidateSource::AiSuggestion {
        if let Some(first) = words.next() {
            let seat = list.len().min(AI_SEAT);
            list.insert(seat, WordItem::new(key, first, 1, source, ""));
        }
        // 多出来的 AI 候选接在末尾：座位前后已经显示的行都不动。
        list.extend(words.map(|word| WordItem::new(key, word, 1, source, "")));
        return true;
    }
    let index = list.len().min(1);
    for (offset, word) in words.enumerate() {
        list.insert(index + offset, WordItem::new(key, word, 1, source, ""));
    }
    rehome_ai_seat(list);
    true
}

/// 把坐 AI 座位的那一行（第一条 AI 候选或占位行）挪回第 2 位；其余 AI 候选留在原处。原地旋转，不分配。
pub(crate) fn rehome_ai_seat(list: &mut [WordItem]) {
    let Some(from) = list.iter().position(|item| item.source.holds_ai_seat()) else {
        return;
    };
    let to = AI_SEAT.min(list.len() - 1);
    if from > to {
        list[to..=from].rotate_right(1);
    } else if from < to {
        list[from..=to].rotate_left(1);
    }
}

fn unique_online_words(
    words: &[String],
    quota: usize,
) -> Option<([Option<&str>; AI_QUOTA], usize)> {
    let mut unique = [None; AI_QUOTA];
    let mut count = 0;
    for word in words {
        if unique[..count]
            .iter()
            .flatten()
            .any(|candidate| *candidate == word.as_str())
        {
            continue;
        }
        if count == quota {
            return None;
        }
        unique[count] = Some(word.as_str());
        count += 1;
    }
    Some((unique, count))
}

fn mark_existing_online_words(
    list: &[WordItem],
    unique: &mut [Option<&str>; AI_QUOTA],
    unique_count: usize,
) -> usize {
    let mut new_count = 0;
    if list.len() <= EXISTING_WORD_LINEAR_SCAN_LIMIT {
        for word in unique.iter_mut().take(unique_count) {
            if list
                .iter()
                .any(|item| item.word == *word.as_ref().expect("unique online word is present"))
            {
                *word = None;
            } else {
                new_count += 1;
            }
        }
        return new_count;
    }
    let existing: HashSet<&str> = list.iter().map(|item| item.word.as_str()).collect();
    for word in unique.iter_mut().take(unique_count) {
        if existing.contains(word.as_ref().expect("unique online word is present")) {
            *word = None;
        } else {
            new_count += 1;
        }
    }
    new_count
}

/// Non-empty, at most 4096 bytes, no C0 control byte and no DEL.
fn is_acceptable_online_word(word: &str) -> bool {
    !word.is_empty()
        && word.len() <= MAX_ONLINE_WORD_BYTES
        && !word.bytes().any(|byte| byte < 32 || byte == 127)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(word: &str, source: CandidateSource) -> WordItem {
        WordItem::new("ni", word, 100, source, "ni")
    }

    fn words(list: &[&str]) -> Vec<String> {
        list.iter().map(|word| word.to_string()).collect()
    }

    fn shape(list: &[WordItem]) -> Vec<(&str, CandidateSource)> {
        list.iter()
            .map(|item| (item.word.as_str(), item.source))
            .collect()
    }

    fn dictionary_list() -> Vec<WordItem> {
        vec![
            row("你", CandidateSource::Database),
            row("尼", CandidateSource::Database),
            row("泥", CandidateSource::Database),
        ]
    }

    #[test]
    fn unique_online_words_keep_order_without_heap_tracking() {
        let input = words(&["甲", "乙", "甲", "丙"]);
        let (unique, count) = unique_online_words(&input, 3).unwrap();
        assert_eq!(count, 3);
        assert_eq!(unique[..count], [Some("甲"), Some("乙"), Some("丙")]);
        assert!(unique_online_words(&words(&["甲", "乙", "丙", "丁"]), 3).is_none());
    }

    #[test]
    fn existing_words_use_a_zero_allocation_scan_for_short_lists() {
        let list = dictionary_list();
        let mut unique = [
            Some("你"),
            Some("智"),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        ];
        let ((new_count, unique), allocations) =
            crate::ime::personal_rerank::allocations::count(|| {
                (mark_existing_online_words(&list, &mut unique, 2), unique)
            });
        assert_eq!(new_count, 1);
        assert_eq!(allocations, 0);
        assert_eq!(unique[..2], [None, Some("智")]);

        let large_list: Vec<WordItem> = (0..=EXISTING_WORD_LINEAR_SCAN_LIMIT)
            .map(|index| row(&format!("已有{index}"), CandidateSource::Database))
            .collect();
        let mut unique = [
            Some("已有0"),
            Some("新"),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        ];
        assert_eq!(mark_existing_online_words(&large_list, &mut unique, 2), 1);
        assert_eq!(unique[..2], [None, Some("新")]);
    }

    #[test]
    fn validates_online_batches_without_constructing_candidate_rows() {
        assert!(validate_online_candidate_batch(
            &words(&["智一", "智二", "智一"]),
            CandidateSource::AiSuggestion
        ));
        assert!(!validate_online_candidate_batch(
            &words(&[
                "词0", "词1", "词2", "词3", "词4", "词5", "词6", "词7", "词8", "词9", "词10"
            ]),
            CandidateSource::AiSuggestion
        ));
        assert!(!validate_online_candidate_batch(
            &words(&["好", "坏\n"]),
            CandidateSource::AiSuggestion
        ));
        assert!(!validate_online_candidate_batch(
            &[],
            CandidateSource::CloudSuggestion
        ));
        assert!(!validate_online_candidate_batch(
            &words(&["好"]),
            CandidateSource::Database
        ));
    }

    #[test]
    fn cloud_takes_slot_one_and_ai_slot_two() {
        let mut list = dictionary_list();
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["云"]),
            CandidateSource::CloudSuggestion
        ));
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["智一", "智二"]),
            CandidateSource::AiSuggestion
        ));
        // 第一条 AI 候选坐第 2 位，其余接在末尾（#6888）。
        assert_eq!(
            shape(&list),
            vec![
                ("你", CandidateSource::Database),
                ("云", CandidateSource::CloudSuggestion),
                ("智一", CandidateSource::AiSuggestion),
                ("尼", CandidateSource::Database),
                ("泥", CandidateSource::Database),
                ("智二", CandidateSource::AiSuggestion),
            ]
        );
        let inserted = &list[1];
        assert_eq!(inserted.pinyin, "ni");
        assert_eq!(inserted.canonical_pinyin, "");
        assert_eq!(inserted.weight, 1);
    }

    #[test]
    fn a_later_cloud_row_rehomes_the_ai_seat_to_slot_two() {
        let mut list = dictionary_list();
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["智一", "智二"]),
            CandidateSource::AiSuggestion
        ));
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["云"]),
            CandidateSource::CloudSuggestion
        ));
        assert_eq!(
            shape(&list),
            vec![
                ("你", CandidateSource::Database),
                ("云", CandidateSource::CloudSuggestion),
                ("智一", CandidateSource::AiSuggestion),
                ("尼", CandidateSource::Database),
                ("泥", CandidateSource::Database),
                ("智二", CandidateSource::AiSuggestion),
            ]
        );
    }

    fn pending_list() -> Vec<WordItem> {
        vec![
            row("你", CandidateSource::Database),
            row("尼", CandidateSource::Database),
            row(AI_PENDING_TEXT, CandidateSource::AiPending),
            row("泥", CandidateSource::Database),
            row("呢", CandidateSource::Database),
            row("拟", CandidateSource::Database),
        ]
    }

    fn non_ai_positions(list: &[WordItem]) -> Vec<(usize, &str)> {
        list.iter()
            .enumerate()
            .filter(|(_, item)| !item.source.holds_ai_seat())
            .map(|(index, item)| (index, item.word.as_str()))
            .collect()
    }

    #[test]
    fn an_ai_batch_replaces_the_placeholder_without_moving_other_rows() {
        for batch in [vec!["智一"], vec!["智一", "智二", "智三"]] {
            let mut list = pending_list();
            let before: Vec<(usize, String)> = non_ai_positions(&list)
                .into_iter()
                .map(|(index, word)| (index, word.to_owned()))
                .collect();
            assert!(replace_online_candidate_batch(
                &mut list,
                "ni",
                &words(&batch),
                CandidateSource::AiSuggestion
            ));
            let after: Vec<(usize, String)> = non_ai_positions(&list)
                .into_iter()
                .map(|(index, word)| (index, word.to_owned()))
                .collect();
            assert_eq!(after, before, "{batch:?}");
            assert_eq!(list[AI_SEAT].word, "智一");
            assert_eq!(list[AI_SEAT].source, CandidateSource::AiSuggestion);
            assert!(!list
                .iter()
                .any(|item| item.source == CandidateSource::AiPending));
            // 多出来的 AI 候选按回答的顺序排在末尾。
            let tail: Vec<&str> = list[6..].iter().map(|item| item.word.as_str()).collect();
            assert_eq!(tail, batch[1..].to_vec());
        }
    }

    #[test]
    fn an_empty_answer_leaves_the_placeholder_in_its_seat() {
        let original = pending_list();
        let mut list = original.clone();
        assert!(!replace_online_candidate_batch(
            &mut list,
            "ni",
            &[],
            CandidateSource::AiSuggestion
        ));
        assert_eq!(list, original);
    }

    #[test]
    fn a_cloud_answer_after_the_placeholder_keeps_it_in_slot_two() {
        let mut list = pending_list();
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["云"]),
            CandidateSource::CloudSuggestion
        ));
        assert_eq!(list[1].word, "云");
        assert_eq!(list[AI_SEAT].source, CandidateSource::AiPending);
        assert_eq!(list.len(), 7);
    }

    #[test]
    fn cloud_updates_reuse_row_storage_with_and_without_ai() {
        for with_ai in [false, true] {
            let mut list = Vec::with_capacity(32);
            list.extend(dictionary_list());
            if with_ai {
                assert!(replace_online_candidate_batch(
                    &mut list,
                    "ni",
                    &words(&["智一", "智二"]),
                    CandidateSource::AiSuggestion,
                ));
            }
            let pointer = list.as_ptr();
            let capacity = list.capacity();
            let batch = words(&["云"]);

            let (accepted, allocations) = crate::ime::personal_rerank::allocations::count(|| {
                replace_online_candidate_batch(
                    &mut list,
                    "ni",
                    &batch,
                    CandidateSource::CloudSuggestion,
                )
            });

            assert!(accepted);
            assert_eq!(allocations, 2, "云候选只需分配词面和键：{with_ai}");
            assert_eq!(list.as_ptr(), pointer);
            assert_eq!(list.capacity(), capacity);
            assert_eq!(list[1].word, "云");
            if with_ai {
                assert_eq!(list[2].word, "智一");
                assert_eq!(list.last().unwrap().word, "智二");
            }
        }
    }

    #[test]
    fn a_new_batch_replaces_the_source_rows() {
        let mut list = dictionary_list();
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["云一"]),
            CandidateSource::CloudSuggestion
        ));
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["云二"]),
            CandidateSource::CloudSuggestion
        ));
        assert_eq!(
            list.iter()
                .filter(|item| item.source == CandidateSource::CloudSuggestion)
                .map(|item| item.word.as_str())
                .collect::<Vec<_>>(),
            vec!["云二"]
        );
        assert_eq!(list[1].word, "云二");
    }

    #[test]
    fn words_already_listed_are_skipped() {
        let mut list = dictionary_list();
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &words(&["尼", "智"]),
            CandidateSource::AiSuggestion
        ));
        assert_eq!(
            shape(&list),
            vec![
                ("你", CandidateSource::Database),
                ("尼", CandidateSource::Database),
                ("智", CandidateSource::AiSuggestion),
                ("泥", CandidateSource::Database),
            ]
        );
    }

    #[test]
    fn duplicates_are_removed_before_the_quota() {
        // Engine #208: twelve AI words with two repeats are ten distinct words.
        let mut batch: Vec<String> = (0..10).map(|index| format!("词{index}")).collect();
        batch.push("词0".to_string());
        batch.push("词1".to_string());
        let mut list = dictionary_list();
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &batch,
            CandidateSource::AiSuggestion
        ));
        let ai: Vec<&str> = list
            .iter()
            .filter(|item| item.source == CandidateSource::AiSuggestion)
            .map(|item| item.word.as_str())
            .collect();
        assert_eq!(ai.len(), 10);
        assert_eq!(ai[0], "词0");
        assert_eq!(ai[9], "词9");

        let mut cloud = dictionary_list();
        assert!(replace_online_candidate_batch(
            &mut cloud,
            "ni",
            &words(&["云", "云"]),
            CandidateSource::CloudSuggestion
        ));
    }

    #[test]
    fn over_quota_and_invalid_batches_leave_the_list_alone() {
        let original = dictionary_list();
        let eleven: Vec<String> = (0..11).map(|index| format!("词{index}")).collect();
        let cases: Vec<(Vec<String>, CandidateSource)> = vec![
            (eleven, CandidateSource::AiSuggestion),
            (words(&["云一", "云二"]), CandidateSource::CloudSuggestion),
            (Vec::new(), CandidateSource::AiSuggestion),
            (words(&["好", ""]), CandidateSource::AiSuggestion),
            (words(&["好", "坏\n"]), CandidateSource::AiSuggestion),
            (words(&["\u{7f}"]), CandidateSource::CloudSuggestion),
            (
                vec!["字".repeat(MAX_ONLINE_WORD_BYTES / 3 + 1)],
                CandidateSource::CloudSuggestion,
            ),
            (words(&["好"]), CandidateSource::Database),
            (words(&["好"]), CandidateSource::Generated),
        ];
        for (batch, source) in cases {
            let mut list = original.clone();
            assert!(
                !replace_online_candidate_batch(&mut list, "ni", &batch, source),
                "{batch:?} {source:?}"
            );
            assert_eq!(list, original);
        }

        let mut list = original.clone();
        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &["a".repeat(MAX_ONLINE_WORD_BYTES)],
            CandidateSource::CloudSuggestion
        ));
    }

    #[test]
    fn short_lists_clamp_the_slots() {
        let mut empty = Vec::new();
        assert!(replace_online_candidate_batch(
            &mut empty,
            "ni",
            &words(&["智"]),
            CandidateSource::AiSuggestion
        ));
        assert_eq!(shape(&empty), vec![("智", CandidateSource::AiSuggestion)]);

        let mut one = vec![row("你", CandidateSource::Database)];
        assert!(replace_online_candidate_batch(
            &mut one,
            "ni",
            &words(&["智一", "智二"]),
            CandidateSource::AiSuggestion
        ));
        assert!(replace_online_candidate_batch(
            &mut one,
            "ni",
            &words(&["云"]),
            CandidateSource::CloudSuggestion
        ));
        assert_eq!(
            shape(&one),
            vec![
                ("你", CandidateSource::Database),
                ("云", CandidateSource::CloudSuggestion),
                ("智一", CandidateSource::AiSuggestion),
                ("智二", CandidateSource::AiSuggestion),
            ]
        );
    }

    #[test]
    fn batch_insertion_reserves_new_rows() {
        let mut list = Vec::with_capacity(1);
        list.push(row("你", CandidateSource::Database));
        let batch: Vec<String> = (0..10).map(|index| format!("词{index}")).collect();

        assert!(replace_online_candidate_batch(
            &mut list,
            "ni",
            &batch,
            CandidateSource::AiSuggestion
        ));
        assert_eq!(list.len(), 11);
        assert_eq!(list.capacity(), 11);
    }
}
