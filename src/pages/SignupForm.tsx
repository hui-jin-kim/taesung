import React, { useState } from "react";

type SignupFormProps = {
  onClose: () => void;
};

export default function SignupForm({ onClose }: SignupFormProps) {
  const [values, setValues] = useState({
    name: "",
    gender: "",
    birth: "",
    email: "",
    phone: "",
  });

  const updateValue =
    (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("회원가입 신청", values);
  };

  return (
    <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 bg-white">
        <h2 className="text-sm font-semibold text-neutral-700">무료 회원가입</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-700"
        >
          닫기
        </button>
      </div>
      <form className="space-y-3 p-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">이름</label>
          <input
            value={values.name}
            onChange={updateValue("name")}
            placeholder="실명 입력"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">성별</label>
          <select
            value={values.gender}
            onChange={updateValue("gender")}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          >
            <option value="">선택</option>
            <option value="male">남</option>
            <option value="female">여</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">생년월일</label>
          <input
            type="date"
            value={values.birth}
            onChange={updateValue("birth")}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">이메일</label>
          <input
            type="email"
            value={values.email}
            onChange={updateValue("email")}
            placeholder="example@company.com"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-500">전화번호</label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={values.phone}
              onChange={updateValue("phone")}
              placeholder="010-xxxx-xxxx"
              className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="button"
              className={`rounded-lg px-3 text-sm font-semibold ${
                values.phone.length >= 10
                  ? "border border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
              }`}
              disabled={values.phone.length < 10}
            >
              카카오 인증
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-2xl bg-neutral-900 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          회원가입 신청
        </button>
      </form>
    </div>
  );
}
