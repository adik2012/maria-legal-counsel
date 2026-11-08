function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireSafeInteger(value, label, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${label} must be a safe integer >= ${minimum}`);
  }
  return value;
}

function requireEntry(record, key, label) {
  requireRecord(record, label);
  if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(record, key)) {
    throw new RangeError(`unknown ${label} key: ${String(key)}`);
  }
  return record[key];
}

function requireRatio(value, label) {
  const ratio = requireRecord(value, label);
  return {
    numerator: requireSafeInteger(ratio.numerator, `${label}.numerator`, 1),
    denominator: requireSafeInteger(ratio.denominator, `${label}.denominator`, 1)
  };
}

function multiplySafeIntegers(left, right, label) {
  const product = left * right;
  if (!Number.isSafeInteger(product)) {
    throw new RangeError(`${label} exceeds the safe integer range`);
  }
  return product;
}

function addSafeIntegers(left, right, label) {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new RangeError(`${label} exceeds the safe integer range`);
  }
  return sum;
}

function roundHalfUpToIncrement(numerator, denominator, incrementKop) {
  requireSafeInteger(numerator, "amount numerator", 0);
  requireSafeInteger(denominator, "amount denominator", 1);
  requireSafeInteger(incrementKop, "rounding increment", 1);

  const amountNumerator = BigInt(numerator);
  const amountDenominator = BigInt(denominator);
  const increment = BigInt(incrementKop);
  const roundedUnits =
    (2n * amountNumerator + amountDenominator * increment) /
    (2n * amountDenominator * increment);
  const roundedKop = roundedUnits * increment;

  if (roundedKop > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("rounded amount exceeds the safe integer range");
  }
  return Number(roundedKop);
}

export function calcCase4Price(calculatorConfig, selection) {
  const appConfig = requireRecord(calculatorConfig, "app config");
  const calculator = requireRecord(appConfig.calculator, "calculator config");
  const chosen = requireRecord(selection, "selection");
  const roundingIncrementKop = requireSafeInteger(
    calculator.rounding_increment_kop,
    "rounding_increment_kop",
    1
  );
  const categoryRatio = requireRatio(
    requireEntry(calculator.category_multiplier, chosen.disputeCategory, "disputeCategory"),
    "category multiplier"
  );
  const format = requireRecord(
    requireEntry(appConfig.options, chosen.workFormat, "workFormat"),
    "work format"
  );
  const formatAddonKop = requireSafeInteger(format.fee_kop, "format fee", 0);
  const urgencyRatio = requireRatio(
    requireEntry(calculator.urgency_multiplier, chosen.urgency, "urgency"),
    "urgency multiplier"
  );

  if (!Array.isArray(chosen.items) || chosen.items.length < 1) {
    throw new TypeError("items must be a non-empty array");
  }
  const maxItems = requireSafeInteger(appConfig.max_items, "max_items", 1);
  const maxQty = requireSafeInteger(appConfig.max_qty, "max_qty", 1);
  if (chosen.items.length > maxItems) {
    throw new RangeError("too many items");
  }

  const mergedItems = new Map();
  for (const itemValue of chosen.items) {
    const item = requireRecord(itemValue, "item");
    const code = item.code;
    const qty = requireSafeInteger(item.qty, "item quantity", 1);
    if (qty > maxQty) {
      throw new RangeError("item quantity exceeds max_qty");
    }
    const previousQty = mergedItems.get(code) || 0;
    const mergedQty = addSafeIntegers(previousQty, qty, "merged item quantity");
    if (mergedQty > maxQty) {
      throw new RangeError("merged item quantity exceeds max_qty");
    }
    mergedItems.set(code, mergedQty);
  }

  let documentCostKop = 0;
  for (const [code, qty] of mergedItems) {
    const basePriceKop = requireSafeInteger(
      requireEntry(calculator.base_price_kop, code, "docType"),
      "base price",
      0
    );
    const documentNumerator = multiplySafeIntegers(
      basePriceKop,
      categoryRatio.numerator,
      "doc price"
    );
    const unitCostKop = roundHalfUpToIncrement(
      documentNumerator,
      categoryRatio.denominator,
      roundingIncrementKop
    );
    const lineCostKop = multiplySafeIntegers(unitCostKop, qty, "quantity total");
    documentCostKop = addSafeIntegers(documentCostKop, lineCostKop, "doc total");
  }

  const subtotalKop = addSafeIntegers(documentCostKop, formatAddonKop, "subtotal");
  const totalNumerator = multiplySafeIntegers(
    subtotalKop,
    urgencyRatio.numerator,
    "total price"
  );
  const totalKop = roundHalfUpToIncrement(
    totalNumerator,
    urgencyRatio.denominator,
    roundingIncrementKop
  );

  return {
    documentCostKop,
    formatAddonKop,
    subtotalKop,
    totalKop
  };
}
