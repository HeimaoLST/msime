package app.msime.android;

/** 一次输入会话中，输入连接失败后是否值得自动重建共享会话。 */
final class InputFailureRecoveryPolicy {
    static final int MAX_AUTOMATIC_RETRIES = 1;

    private InputFailureRecoveryPolicy() {}

    static boolean shouldRetry(int attempts, boolean hasSession, boolean hasConnection,
            boolean hasRuntimeOptions) {
        return attempts < MAX_AUTOMATIC_RETRIES
            && hasSession && hasConnection && hasRuntimeOptions;
    }
}
