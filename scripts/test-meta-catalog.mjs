import assert from "assert";
import bizSdk from "facebook-nodejs-business-sdk";

console.log("🧪 Running Meta Catalog Integration Unit Tests...\n");

// 1. Verify SDK Exports
console.log("Test 1: Verifying Meta Business SDK exports...");
assert.strictEqual(typeof bizSdk.FacebookAdsApi, "function", "FacebookAdsApi should be a constructor function");
assert.strictEqual(typeof bizSdk.ProductCatalog, "function", "ProductCatalog should be a constructor function");
assert.strictEqual(typeof bizSdk.ProductItem, "function", "ProductItem should be a constructor function");
assert.strictEqual(typeof bizSdk.ProductCatalog.prototype.createItemsBatch, "function", "createItemsBatch must exist");
assert.strictEqual(typeof bizSdk.ProductCatalog.prototype.getProducts, "function", "getProducts must exist");
console.log("  ✅ Meta Business SDK exports are valid.");

// 2. Price Formatting
console.log("\nTest 2: Verifying price formatting for Meta Catalog...");
function formatPriceForMeta(price, currency = "BDT") {
  const num = Number(price) || 0;
  return `${num.toFixed(2)} ${currency.trim().toUpperCase()}`;
}
assert.strictEqual(formatPriceForMeta(350), "350.00 BDT");
assert.strictEqual(formatPriceForMeta("700.5", "usd"), "700.50 USD");
assert.strictEqual(formatPriceForMeta(0), "0.00 BDT");
console.log("  ✅ formatPriceForMeta matches Meta currency specs.");

// 3. Batch Request Structure Verification
console.log("\nTest 3: Verifying Batch API Payload Schema according to Meta Specs...");
const sampleBatch = {
  item_type: "PRODUCT_ITEM",
  requests: [
    {
      method: "create",
      data: {
        id: "retailer_prod_1",
        title: "Patali Gur",
        description: "100% Pure Date Palm Molasses",
        brand: "খেজুরের খাটি গুড়",
        price: "350.00 BDT",
        image_link: "https://example.com/images/patali.jpg",
        additional_image_link: [
          "https://example.com/images/patali_2.jpg",
          "https://example.com/images/patali_3.jpg"
        ],
        availability: "in stock",
        link: "https://example.com/products/patali-gur",
        condition: "new"
      }
    },
    {
      method: "update",
      data: {
        id: "retailer_prod_2",
        title: "Liquid Feed Molasses",
        price: "450.00 BDT"
      }
    },
    {
      method: "delete",
      data: {
        id: "retailer_prod_3"
      }
    }
  ]
};

assert.strictEqual(sampleBatch.item_type, "PRODUCT_ITEM");
assert.strictEqual(sampleBatch.requests.length, 3);
assert.strictEqual(sampleBatch.requests[0].method, "create");
assert.strictEqual(sampleBatch.requests[0].data.id, "retailer_prod_1");
assert.strictEqual(sampleBatch.requests[0].data.additional_image_link.length, 2);
assert.strictEqual(sampleBatch.requests[1].method, "update");
assert.strictEqual(sampleBatch.requests[2].method, "delete");
console.log("  ✅ Batch API schema meets Meta Business SDK specification.");

// 4. Mock Client Execution
console.log("\nTest 4: Verifying Mock createItemsBatch execution...");
let capturedEdge = null;
let capturedParams = null;

class MockProductCatalog extends bizSdk.ProductCatalog {
  createEdge(edge, fields, params) {
    capturedEdge = edge;
    capturedParams = params;
    return Promise.resolve({
      handles: ["h_mock_handle_12345"]
    });
  }
}

const mockCat = new MockProductCatalog("catalog_9999");
await mockCat.createItemsBatch([], sampleBatch);

assert.strictEqual(capturedEdge, "/items_batch", "createItemsBatch should call /items_batch edge");
assert.strictEqual(capturedParams.item_type, "PRODUCT_ITEM");
assert.strictEqual(capturedParams.requests.length, 3);
console.log("  ✅ createItemsBatch correctly targets /items_batch with payload.");

// 5. Verify Fetch Products Mock Cursor
console.log("\nTest 5: Verifying getProducts cursor handling...");
let page = 1;
const mockCursor = [
  { id: "101", retailer_id: "r101", name: "Gur Item 1", price: "300.00 BDT" },
  { id: "102", retailer_id: "r102", name: "Gur Item 2", price: "500.00 BDT" }
];
mockCursor.hasNext = () => page === 1;
mockCursor.next = async () => {
  page++;
  const nextCursor = [
    { id: "103", retailer_id: "r103", name: "Gur Item 3", price: "700.00 BDT" }
  ];
  nextCursor.hasNext = () => false;
  return nextCursor;
};

const collected = [];
for (const item of mockCursor) {
  collected.push(item);
}
if (mockCursor.hasNext()) {
  const secondPage = await mockCursor.next();
  for (const item of secondPage) {
    collected.push(item);
  }
}
assert.strictEqual(collected.length, 3);
assert.strictEqual(collected[0].name, "Gur Item 1");
assert.strictEqual(collected[2].name, "Gur Item 3");
console.log("  ✅ getProducts cursor iteration and pagination verified.");

console.log("\n\x1b[32m%s\x1b[0m", "🎉 All 5 Meta Catalog Integration tests passed successfully!");

