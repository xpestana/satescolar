import { describe, expect, it } from "vitest";
import { collectBillingRecipients } from "./billingRecipients";

describe("collectBillingRecipients", () => {
  const contacts = [
    { email: "Admin@Colegio.com", is_active: true },
    { email: "pausado@colegio.com", is_active: false },
    { email: "sin-arroba", is_active: true },
  ];

  it("includes the owner and active contacts, normalized and without duplicates", () => {
    expect(
      collectBillingRecipients({ ownerEmails: ["admin@colegio.com", "directora@colegio.com"], notifyOwner: true, contacts }),
    ).toEqual(["admin@colegio.com", "directora@colegio.com"]);
  });

  it("leaves the owner out when notifyOwner is off", () => {
    expect(collectBillingRecipients({ ownerEmails: ["directora@colegio.com"], notifyOwner: false, contacts })).toEqual([
      "admin@colegio.com",
    ]);
  });

  it("returns an empty list when nobody is left", () => {
    expect(collectBillingRecipients({ ownerEmails: [null, ""], notifyOwner: true, contacts: [] })).toEqual([]);
  });
});
