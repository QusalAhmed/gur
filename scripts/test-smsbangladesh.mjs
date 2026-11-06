import assert from "node:assert";

// 1. Phone number normalizer test
function normalizeBdPhoneNumber(input) {
  if (!input || typeof input !== "string") return null;
  let digits = input.replace(/\D/g, "");

  if (digits.length === 13 && digits.startsWith("8801")) {
    return digits;
  }
  if (digits.length === 11 && digits.startsWith("01")) {
    return `88${digits}`;
  }
  if (digits.length === 10 && digits.startsWith("1")) {
    return `880${digits}`;
  }
  if (digits.length === 13 && /^8801[3-9]\d{8}$/.test(digits)) {
    return digits;
  }
  return null;
}

// 2. Template renderer test
function renderSmsTemplate(template, variables) {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, "g");
    const replacement = value !== undefined && value !== null ? String(value) : "";
    rendered = rendered.replace(regex, replacement);
  }
  return rendered.trim();
}

console.log("=== Testing Phone Normalizer ===");
assert.strictEqual(normalizeBdPhoneNumber("01712345678"), "8801712345678");
assert.strictEqual(normalizeBdPhoneNumber("+8801812345678"), "8801812345678");
assert.strictEqual(normalizeBdPhoneNumber("8801912345678"), "8801912345678");
assert.strictEqual(normalizeBdPhoneNumber("01300000000"), "8801300000000");
assert.strictEqual(normalizeBdPhoneNumber("1712345678"), "8801712345678");
assert.strictEqual(normalizeBdPhoneNumber("012345"), null);
assert.strictEqual(normalizeBdPhoneNumber(""), null);
assert.strictEqual(normalizeBdPhoneNumber(null), null);
console.log("✔ Phone normalizer passed all assertions!");

console.log("\n=== Testing Template Renderer ===");
const template = "প্রিয় {customer_name}, আপনার অর্ডার #{order_number} সফল হয়েছে। বিল: ৳{amount}।";
const rendered = renderSmsTemplate(template, {
  customer_name: "রাকিব",
  order_number: "ORD-1001",
  amount: 850,
});
assert.strictEqual(
  rendered,
  "প্রিয় রাকিব, আপনার অর্ডার #ORD-1001 সফল হয়েছে। বিল: ৳850।"
);
console.log("✔ Template renderer output:", rendered);
console.log("✔ Template renderer passed all assertions!");

console.log("\nAll unit tests passed successfully!");
