export type RealPricePoint = {
  date: string; // YYYY-MM or YYYY-MM-DD
  price: number; // 원 단위 또는 평당가 등 선택적 해석
};

export interface RealPriceProvider {
  getSeries(params: { complexId?: string; complexName?: string; from?: string; to?: string }): Promise<RealPricePoint[]>;
}

