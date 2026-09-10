import type { CommerceAdapter } from "../types";

export const mockCommerceAdapter: CommerceAdapter = {
  async createCheckout() {
    return {
      checkoutUrl: "/mock/checkout",
      orderId: "mock-order-1",
    };
  },
};
