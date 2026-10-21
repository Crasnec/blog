/** A post-specific story composed from the reusable queue figure. */
import { Queue } from "../../../../components/figures";
import { checkoutPreset, type CheckoutOptions } from "../../../../figures/presets/checkout";

export default function CheckoutComparison({ registers = 3, customers = 12, slow = 0, seed = 4, caption = "장바구니가 가득 찬 손님 한 명이 위쪽에서는 한 줄 전체를 붙잡고, 아래쪽에서는 계산대 하나만 붙잡는다." }: CheckoutOptions & { caption?: string }) {
	return <Queue props={checkoutPreset({ registers, customers, slow, seed })} caption={caption} />;
}
