import { useAtomValue, useSetAtom } from "jotai";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useToast } from "./Toast";
import {
  getRoleLabel,
  isAuthenticatedAtom,
  isManagerAtom,
  sessionAtom,
  signOutAtom,
} from "../auth";

export const navLinkClass =
  "cursor-pointer border-0 bg-transparent p-0 text-[12px] font-normal leading-none tracking-[-0.12px] text-white hover:text-body-muted focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-focus";

function Mark() {
  return (
    <svg
      className="block text-parchment"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3.2 6.2 9 3.1l5.8 3.1v9.2H3.2V6.2Zm1.6 1.1v6.9h8.4V7.3L9 5.1 4.8 7.3Z"
      />
    </svg>
  );
}

export default function GlobalNav({ trailing }) {
  const authenticated = useAtomValue(isAuthenticatedAtom);
  const isManager = useAtomValue(isManagerAtom);
  const session = useAtomValue(sessionAtom);
  const signOut = useSetAtom(signOutAtom);
  const navigate = useNavigate();
  const notify = useToast();

  function handleSignOut() {
    signOut();
    notify("Đã đăng xuất.");
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 h-11 bg-black text-white">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-[22px]">
        <div className="flex items-center gap-5">
          <Link
            to={authenticated ? "/" : "/login"}
            className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-normal leading-none tracking-[-0.12px] text-white hover:text-body-muted focus-visible:outline-offset-[3px]"
            aria-label="Trang chủ"
            title="Trang chủ"
          >
            <Mark />
            <span>Trang chủ</span>
          </Link>
          {isManager ? (
            <NavLink to="/thong-ke" className={navLinkClass}>
              Thống kê
            </NavLink>
          ) : null}
        </div>
        {authenticated || trailing ? (
          <div className="flex items-center gap-5">
            {authenticated && session?.role ? (
              <span className="text-[12px] font-normal leading-none tracking-[-0.12px] text-body-muted">
                {getRoleLabel(session.role)}
              </span>
            ) : null}
            {trailing}
            {authenticated ? (
              <button
                className={navLinkClass}
                type="button"
                onClick={handleSignOut}
              >
                Đăng xuất
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
