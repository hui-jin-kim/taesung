import React from "react";
import { useScript } from "../lib/useScript";

type AddressParts = {
  region1?: string; // 시/도
  region2?: string; // 시/군/구
  region3?: string; // 읍/면/동
  zonecode?: string;
  roadAddress?: string;
  jibunAddress?: string;
};

export function AddressSearch({
  value,
  onChange,
  onSelectParts,
  placeholder = "주소 검색",
  disabled,
}: {
  value: string;
  onChange: (addr: string) => void;
  onSelectParts?: (p: AddressParts) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { loaded } = useScript("https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js");

  const open = () => {
    const openFn = () => {
      if (!window.daum || !window.daum.Postcode) {
        alert("주소 검색 스크립트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const pc = new window.daum.Postcode({
        oncomplete: (data: any) => {
          const addr = data.roadAddress || data.jibunAddress || data.address || "";
          onChange(addr);
          onSelectParts?.({
            region1: data.sido,
            region2: data.sigungu,
            region3: data.bname,
            zonecode: data.zonecode,
            roadAddress: data.roadAddress,
            jibunAddress: data.jibunAddress,
          });
        },
      });
      pc.open();
    };
    if (loaded) openFn(); else setTimeout(openFn, 200);
  };

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border rounded px-3 py-2 text-sm border-neutral-300"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={open}
        className="px-3 py-2 rounded border border-neutral-300 bg-white text-sm"
        disabled={disabled}
        title="주소 검색"
      >
        주소검색
      </button>
    </div>
  );
}

export default AddressSearch;

