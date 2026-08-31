import type { ILoginResponse, IWebshopInfo } from "@storesprite/unas-json-client";
import type { UnasConnectionRecord } from "../../src/types/unas/UnasConnection.interface.js";

export function makeWebshopInfo(overrides: Partial<IWebshopInfo> = {}): IWebshopInfo {
  return {
    webshopName: "Test Webshop",
    webshopUrl: "www.testwebshop.hu",
    contact: {
      name: "Test Kft.",
      email: "test@testwebshop.hu",
      phone: "+36-1/000-0000",
      mobile: "+3610000000",
    },
    trader: {
      name: "Test Kft.",
      country: "HU",
      zip: "1000",
      county: "",
      city: "Budapest",
      address: "Test utca 1.",
      phone: "+36-1/000-0000",
      fax: "",
      defaultCurrency: "HUF",
      vat: "",
      euVat: "",
      email: "test@testwebshop.hu",
      registrationNumber: "",
      registrationCourt: "",
      licenseNumber: "",
      registrationDate: "",
      bankAccount: "",
      iban: "",
      website: "",
    },
    languages: [{ code: "hu", default: "yes" }],
    ...overrides,
  };
}

export function makeLoginResponse(overrides: Partial<ILoginResponse> = {}): ILoginResponse {
  return {
    token: "tok-123",
    expire: "2026-08-27 12:00:00",
    expireTime: 1724752800,
    shopId: 83219,
    subscription: "vip-100000",
    permissions: [],
    status: "ok",
    webshopInfo: makeWebshopInfo(),
    ...overrides,
  };
}

export function makeUnasConnectionRecord(overrides: Partial<UnasConnectionRecord> = {}): UnasConnectionRecord {
  const { token: _token, ...loginFields } = makeLoginResponse();
  return { ...loginFields, token: null, checkedAt: "2026-08-24T00:00:00.000Z", ...overrides };
}
