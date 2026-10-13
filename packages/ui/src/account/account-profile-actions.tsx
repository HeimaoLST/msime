import { ActionButton } from "../core/action-button";
import { ProfileGroup } from "./account-identity-details";
import * as account from "./account-style";

export type AccountProfileAction = "logout" | "logout-all" | "relogin" | "delete";
export type HarmonyProfileAction = Exclude<AccountProfileAction, "relogin">;

type Props =
  | {
      variant: "mobile";
      busy: boolean;
      onSelect: (action: AccountProfileAction) => void;
    }
  | {
      variant: "harmony";
      busy: boolean;
      onSelect: (action: HarmonyProfileAction) => void;
    };

const logoutActions = [
  { action: "logout", label: "退出登录" },
  { action: "logout-all", label: "退出所有设备" },
] as const;

/** Account session choices shared by the mobile and Harmony profile pages. */
export function AccountProfileActions(props: Props) {
  if (props.variant === "mobile")
    return (
      <section className={`${account.section} ${account.stack}`}>
        <h2 className={account.heading}>账号操作</h2>
        <div className={account.actionRow}>
          {logoutActions.map(({ action, label }) => (
            <ActionButton
              key={action}
              action={() => props.onSelect(action)}
              className="secondary"
              disabled={props.busy}
              label={label}
            />
          ))}
          <ActionButton
            action={() => props.onSelect("relogin")}
            className="secondary"
            disabled={props.busy}
            label="重新登录"
          />
          <ActionButton
            action={() => props.onSelect("delete")}
            className="danger-text"
            disabled={props.busy}
            label="注销账号"
          />
        </div>
      </section>
    );

  return (
    <>
      <ProfileGroup>
        {logoutActions.map(({ action, label }) => (
          <button
            key={action}
            type="button"
            className={account.profileDangerRow}
            disabled={props.busy}
            onClick={() => props.onSelect(action)}
          >
            {label}
          </button>
        ))}
      </ProfileGroup>
      <ProfileGroup>
        <button
          type="button"
          className={account.profileDangerRow}
          disabled={props.busy}
          onClick={() => props.onSelect("delete")}
        >
          注销账号
        </button>
      </ProfileGroup>
    </>
  );
}
