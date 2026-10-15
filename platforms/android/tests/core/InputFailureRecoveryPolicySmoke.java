package app.msime.android;

/** 锁住输入连接失败后的单次自动恢复边界。 */
public final class InputFailureRecoveryPolicySmoke {
    public static void main(String[] arguments) {
        check(InputFailureRecoveryPolicy.shouldRetry(0, true, true, true),
            "the first failure with a live session can recover");
        check(!InputFailureRecoveryPolicy.shouldRetry(1, true, true, true),
            "one input session gets only one automatic retry");
        check(!InputFailureRecoveryPolicy.shouldRetry(0, false, true, true),
            "a missing session is already in direct-input fallback");
        check(!InputFailureRecoveryPolicy.shouldRetry(0, true, false, true),
            "a missing editor connection must not restart against no target");
        check(!InputFailureRecoveryPolicy.shouldRetry(0, true, true, false),
            "without runtime options recovery cannot create a session");
        System.out.println("Android input failure recovery policy passed");
    }

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
}
