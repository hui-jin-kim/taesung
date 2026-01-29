import React, { useEffect, useMemo, useState } from "react";

import AdminFrame from "../components/AdminFrame";
import ImportBlock from "../components/ImportBlock";
import { useAuth } from "../context/AuthContext";
import {
  createUserAsAdmin,
  deleteUserProfile,
  listUserProfiles,
  sendReset,
  updateUserName,
  updateUserRole,
  type UserProfile,
} from "../lib/users";
import { exportBuyersExcel, exportListingsExcel } from "../lib/exportExcel";
import { useScript } from "../lib/useScript";

export default function Admin() {
  const { user } = useAuth();
  const isSuperAdmin = useMemo(() => {
    return user?.role === "owner";
  }, [user]);

  return (
    <AdminFrame title="관리 도구">
      <div className="space-y-10">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">엑셀 일괄 등록</h2>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-600 mb-3">
              XLSX 파일에서 매물/매수자 정보를 읽어와 일괄로 등록합니다.
            </p>
            <ImportBlock />
          </div>
        </section>

        <DataExportSection enabled={isSuperAdmin} />

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">사용자 관리</h2>
          {isSuperAdmin ? <UsersTab /> : <UserHint />}
        </section>
      </div>
    </AdminFrame>
  );
}

function UserHint() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
      접근 권한이 없습니다. 슈퍼 관리자에게 문의하세요.
    </div>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserProfile["role"]>("staff");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pending, setPending] = useState<Record<string, UserProfile["role"]>>({});
  const [pendingNames, setPendingNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const canManageOwners = me?.role === "owner";
  const createRoleOptions: Array<UserProfile["role"]> = canManageOwners
    ? ["owner", "admin", "staff"]
    : ["admin", "staff"];
  const editRoleOptions: Array<UserProfile["role"]> = canManageOwners
    ? ["owner", "admin", "staff"]
    : ["owner", "admin", "staff"];

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const list = await listUserProfiles();
    setUsers(list);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !name.trim() || !password.trim()) {
      setError("모든 필드를 입력해 주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await createUserAsAdmin(email.trim(), password, name.trim(), role);
      setEmail("");
      setName("");
      setPassword("");
      setRole("staff");
      await refresh();
    } catch (err: any) {
      const code = err?.code || "";
      if (String(code).includes("auth/email-already-in-use")) {
        setError("이미 사용 중인 이메일입니다.");
      } else {
        setError(err?.message || "계정 생성에 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function applyPendingRoles() {
    if (!Object.keys(pending).length) return;
    setLoading(true);
    try {
      await Promise.all(
        Object.entries(pending).map(([uid, nextRole]) => updateUserRole(uid, nextRole)),
      );
      setPending({});
      await refresh();
      alert("권한 변경이 완료되었습니다.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "권한 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function applyName(uid: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      alert("이름을 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await updateUserName(uid, trimmed);
      setPendingNames((prev) => {
        const copy = { ...prev };
        delete copy[uid];
        return copy;
      });
      await refresh();
      alert("이름이 변경되었습니다.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "이름 변경에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3"
      >
        <p className="font-semibold">사용자 계정 생성</p>
        <div className="grid md:grid-cols-4 gap-3">
          <input
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            placeholder="임시 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserProfile["role"])}
            className="rounded border px-3 py-2 text-sm"
          >
            {createRoleOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "생성 중..." : "생성"}
        </button>
      </form>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">사용자 목록</p>
          <button
            className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm disabled:opacity-50"
            disabled={!Object.keys(pending).length || loading}
            onClick={applyPendingRoles}
          >
            권한 적용
            {Object.keys(pending).length ? ` (${Object.keys(pending).length})` : ""}
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="p-2 text-left">이메일</th>
              <th className="p-2 text-left">이름</th>
              <th className="p-2 text-left">권한</th>
              <th className="p-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} className="border-t">
                <td className="p-2">{u.email}</td>
                <td className="p-2">
                  <input
                    className="rounded border px-2 py-1 text-sm w-full"
                    value={pendingNames[u.uid] ?? u.name ?? ""}
                    placeholder="이름"
                    onChange={(e) =>
                      setPendingNames((prev) => ({
                        ...prev,
                        [u.uid]: e.target.value,
                      }))
                    }
                    disabled={loading}
                  />
                </td>
                <td className="p-2">
                  <select
                    value={pending[u.uid] ?? u.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserProfile["role"];
                      setPending((prev) => {
                        const copy = { ...prev };
                        if (nextRole === u.role) {
                          delete copy[u.uid];
                        } else {
                          copy[u.uid] = nextRole;
                        }
                        return copy;
                      });
                    }}
                    disabled={loading}
                    className="rounded border px-2 py-1 text-sm"
                  >
                    {editRoleOptions.map((opt) => (
                      <option key={opt} value={opt} disabled={!canManageOwners && opt === "owner"}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2 text-right space-x-2">
                  <button
                    type="button"
                    className="text-emerald-600 hover:underline disabled:opacity-50"
                    onClick={() => applyName(u.uid, pendingNames[u.uid] ?? u.name ?? "")}
                    disabled={loading || (pendingNames[u.uid] ?? u.name ?? "") === (u.name ?? "")}
                  >
                    이름 저장
                  </button>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline disabled:opacity-50"
                    onClick={() => handleReset(u.email)}
                    disabled={loading}
                  >
                    비밀번호 재설정
                  </button>
                  <button
                    type="button"
                    className="text-rose-600 hover:underline disabled:opacity-50"
                    onClick={() => handleDelete(u.uid)}
                    disabled={loading}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  async function handleReset(email: string) {
    await sendReset(email);
    alert("비밀번호 재설정 메일을 보냈습니다.");
  }

  async function handleDelete(uid: string) {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    await deleteUserProfile(uid);
    await refresh();
  }
}

function DataExportSection({ enabled }: { enabled: boolean }) {
  const [complex, setComplex] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<null | "listings" | "buyers" | "complex">(null);
  const { loaded: xlsxLoaded, error: xlsxError } = useScript(
    "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js",
  );

  if (!enabled) {
    return (
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        접근 권한이 없습니다. 슈퍼 관리자에게 문의하세요.
      </section>
    );
  }

  const run = async (type: "listings" | "buyers" | "complex") => {
    if (!xlsxLoaded) {
      setMessage("엑셀 라이브러리를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (xlsxError) {
      setMessage("엑셀 라이브러리 로딩에 실패했습니다. 새로고침 후 다시 시도해 주세요.");
      return;
    }
    try {
      setLoading(type);
      setMessage("");
      if (type === "buyers") {
        await exportBuyersExcel();
        setMessage("매수자 엑셀 다운로드가 완료되었습니다.");
      } else if (type === "complex") {
        if (!complex.trim()) {
          setMessage("단지명을 입력해 주세요.");
          return;
        }
        await exportListingsExcel({ complex: complex.trim() });
        setMessage(`"${complex}" 단지 엑셀 다운로드가 완료되었습니다.`);
      } else {
        await exportListingsExcel();
        setMessage("매물 엑셀 다운로드가 완료되었습니다.");
      }
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "엑셀 다운로드에 실패했습니다.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">엑셀 다운로드</h2>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={loading !== null}
            onClick={() => run("listings")}
          >
            {loading === "listings" ? "다운로드 중..." : "매물 전체 다운로드"}
          </button>
          <button
            className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            disabled={loading !== null}
            onClick={() => run("buyers")}
          >
            {loading === "buyers" ? "다운로드 중..." : "매수자 다운로드"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={complex}
            onChange={(e) => setComplex(e.target.value)}
            placeholder="단지명 입력 (예: 반포자이)"
            className="h-9 flex-1 rounded-lg border border-neutral-300 px-3 text-sm"
          />
          <button
            className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm disabled:opacity-50"
            disabled={loading !== null}
            onClick={() => run("complex")}
          >
            {loading === "complex" ? "다운로드 중..." : "단지별 다운로드"}
          </button>
        </div>
        {message ? <p className="text-sm text-neutral-600">{message}</p> : null}
      </div>
    </section>
  );
}
