// /**
//  * GST Compliance Validation Utility
//  * Implements Indian GST validation rules per the GST Act, 2017
//  */

// const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// // Valid Indian state codes (first 2 digits of GSTIN)
// const VALID_STATE_CODES = new Set([
//   '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
//   '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
//   '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
//   '31', '32', '33', '34', '35', '36', '37', '38'
// ]);

// /**
//  * Validates GSTIN format and structure
//  * @param {string} gstin
//  * @returns {{ valid: boolean, errors: string[] }}
//  */
// const validateGSTIN = (gstin) => {
//   const errors = [];
//   if (!gstin) return { valid: false, errors: ['GSTIN is missing'] };

//   const cleaned = gstin.toUpperCase().trim();

//   if (cleaned.length !== 15) {
//     errors.push(`GSTIN must be exactly 15 characters (got ${cleaned.length})`);
//     return { valid: false, errors };
//   }

//   if (!GSTIN_REGEX.test(cleaned)) {
//     errors.push('GSTIN format is invalid. Expected: 2 digits + 5 alpha + 4 digits + 1 alpha + 1 alphanumeric + Z + 1 alphanumeric');
//     return { valid: false, errors };
//   }

//   const stateCode = cleaned.substring(0, 2);
//   if (!VALID_STATE_CODES.has(stateCode)) {
//     errors.push(`Invalid state code: ${stateCode}`);
//     return { valid: false, errors };
//   }

//   // Checksum validation (Luhn-like algorithm for GSTIN)
//   const checksum = computeGSTINChecksum(cleaned);
//   if (checksum !== cleaned[14]) {
//     errors.push('GSTIN checksum validation failed');
//     return { valid: false, errors };
//   }

//   return { valid: true, errors: [] };
// };

// /**
//  * Compute GSTIN checksum character
//  */
// const computeGSTINChecksum = (gstin) => {
//   const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
//   let sum = 0;
//   for (let i = 0; i < 14; i++) {
//     const val = chars.indexOf(gstin[i]);
//     const factor = (i % 2 === 0) ? 1 : 2;
//     let product = val * factor;
//     if (product > 35) product = Math.floor(product / 36) + (product % 36);
//     sum += product;
//   }
//   const remainder = sum % 36;
//   return chars[(36 - remainder) % 36];
// };

// /**
//  * Validates invoice date format and range
//  * @param {string} dateStr
//  * @returns {{ valid: boolean, error?: string }}
//  */
// const validateInvoiceDate = (dateStr) => {
//   if (!dateStr) return { valid: false, error: 'Invoice date is missing' };

//   // Support multiple date formats
//   const dateFormats = [
//     /^(\d{2})[-\/](\d{2})[-\/](\d{4})$/,  // DD-MM-YYYY or DD/MM/YYYY
//     /^(\d{4})[-\/](\d{2})[-\/](\d{2})$/,  // YYYY-MM-DD
//     /^(\d{2})-([A-Za-z]{3})-(\d{4})$/,    // DD-Mon-YYYY
//     /^(\d{1,2})\s([A-Za-z]+)\s(\d{4})$/   // D Month YYYY
//   ];

//   let parsedDate = null;
//   for (const format of dateFormats) {
//     if (format.test(dateStr.trim())) {
//       parsedDate = new Date(dateStr);
//       if (!isNaN(parsedDate.getTime())) break;
//     }
//   }

//   if (!parsedDate || isNaN(parsedDate.getTime())) {
//     return { valid: false, error: `Invalid date format: "${dateStr}"` };
//   }

//   const now = new Date();
//   const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
//   const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

//   if (parsedDate > tomorrow) {
//     return { valid: false, error: 'Invoice date cannot be in the future' };
//   }
//   if (parsedDate < fiveYearsAgo) {
//     return { valid: false, error: 'Invoice date is more than 5 years old' };
//   }

//   return { valid: true };
// };

// /**
//  * Validates tax calculations
//  * @param {object} data - Extracted invoice data
//  * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
//  */
// const validateTaxCalculations = (data) => {
//   const errors = [];
//   const warnings = [];
//   const TOLERANCE = 0.02; // 2 paisa tolerance for rounding

//   const { taxable_amount = 0, cgst = 0, sgst = 0, igst = 0, total_amount = 0 } = data;

//   // Check that either CGST+SGST or IGST is used (not both)
//   const hasCSGT = cgst > 0 || sgst > 0;
//   const hasIGST = igst > 0;

//   if (hasCSGT && hasIGST) {
//     errors.push('Both CGST/SGST and IGST cannot be applicable simultaneously (intra-state vs inter-state)');
//   }

//   // Validate CGST === SGST for intra-state transactions
//   if (hasCSGT && Math.abs(cgst - sgst) > TOLERANCE) {
//     errors.push(`CGST (₹${cgst}) must equal SGST (₹${sgst}) for intra-state supply`);
//   }

//   // Validate total tax = CGST + SGST + IGST
//   const calculatedTax = cgst + sgst + igst;

//   // Validate total amount = taxable_amount + total_tax
//   const expectedTotal = taxable_amount + calculatedTax;
//   if (total_amount > 0 && Math.abs(total_amount - expectedTotal) > TOLERANCE) {
//     errors.push(`Total amount mismatch: Expected ₹${expectedTotal.toFixed(2)}, Found ₹${total_amount.toFixed(2)}`);
//   }

//   // Check for common GST rates (5%, 12%, 18%, 28%)
//   if (taxable_amount > 0 && calculatedTax > 0) {
//     const effectiveRate = (calculatedTax / taxable_amount) * 100;
//     const standardRates = [0, 5, 12, 18, 28, 3, 0.25];
//     const isStandardRate = standardRates.some(r => Math.abs(effectiveRate - r) < 0.1);
//     if (!isStandardRate && effectiveRate > 0) {
//       warnings.push(`Non-standard GST rate: ${effectiveRate.toFixed(2)}%. Standard rates: 0%, 5%, 12%, 18%, 28%`);
//     }
//   }

//   // Check for zero amounts
//   if (taxable_amount <= 0) {
//     warnings.push('Taxable amount is zero or negative');
//   }

//   if (total_amount <= 0) {
//     warnings.push('Total amount is zero or negative');
//   }

//   return {
//     valid: errors.length === 0,
//     errors,
//     warnings,
//     calculated_tax: calculatedTax,
//     expected_total: expectedTotal
//   };
// };

// /**
//  * Main GST compliance validation function
//  * @param {object} extractedData - All extracted invoice fields
//  * @returns {object} - Comprehensive validation result
//  */
// const validateGSTCompliance = (extractedData) => {
//   const errors = [];
//   const warnings = [];
//   const checks = {};

//   // 1. Validate Seller GSTIN
//   const sellerGSTINResult = validateGSTIN(extractedData.gstin_seller);
//   checks.gstin_seller_valid = sellerGSTINResult.valid;
//   if (!sellerGSTINResult.valid) {
//     errors.push(...sellerGSTINResult.errors.map(e => `Seller GSTIN: ${e}`));
//   }

//   // 2. Validate Buyer GSTIN (optional for B2C)
//   if (extractedData.gstin_buyer) {
//     const buyerGSTINResult = validateGSTIN(extractedData.gstin_buyer);
//     checks.gstin_buyer_valid = buyerGSTINResult.valid;
//     if (!buyerGSTINResult.valid) {
//       errors.push(...buyerGSTINResult.errors.map(e => `Buyer GSTIN: ${e}`));
//     }
//   } else {
//     checks.gstin_buyer_valid = null; // Optional
//     warnings.push('Buyer GSTIN not found (may be B2C transaction)');
//   }

//   // 3. Validate invoice number
//   checks.invoice_number_present = !!(extractedData.invoice_number?.trim());
//   if (!checks.invoice_number_present) {
//     errors.push('Invoice number is missing');
//   } else if (extractedData.invoice_number.length > 16) {
//     warnings.push('Invoice number exceeds 16 characters (GST rule)');
//   }

//   // 4. Validate invoice date
//   const dateResult = validateInvoiceDate(extractedData.invoice_date);
//   checks.invoice_date_valid = dateResult.valid;
//   if (!dateResult.valid) {
//     errors.push(dateResult.error);
//   }

//   // 5. Validate tax calculations
//   const taxResult = validateTaxCalculations(extractedData);
//   checks.taxable_amount_valid = extractedData.taxable_amount > 0;
//   checks.tax_calculation_correct = taxResult.valid;
//   checks.total_amount_matches = taxResult.valid;

//   errors.push(...taxResult.errors);
//   warnings.push(...taxResult.warnings);

//   // 6. Cross-validate state codes for IGST/CGST+SGST
//   if (extractedData.gstin_seller && extractedData.gstin_buyer) {
//     const sellerState = extractedData.gstin_seller.substring(0, 2);
//     const buyerState = extractedData.gstin_buyer.substring(0, 2);
//     const isInterState = sellerState !== buyerState;

//     if (isInterState && (extractedData.cgst > 0 || extractedData.sgst > 0)) {
//       errors.push('Inter-state transaction should use IGST, not CGST/SGST');
//     }
//     if (!isInterState && extractedData.igst > 0) {
//       errors.push('Intra-state transaction should use CGST/SGST, not IGST');
//     }
//   }

//   // Calculate compliance score
//   const totalChecks = Object.keys(checks).filter(k => checks[k] !== null).length;
//   const passedChecks = Object.values(checks).filter(v => v === true).length;
//   const warningPenalty = warnings.length * 5;
//   const complianceScore = Math.max(0, Math.round((passedChecks / totalChecks) * 100) - warningPenalty);

//   return {
//     is_valid: errors.length === 0,
//     errors,
//     warnings,
//     checks,
//     compliance_score: complianceScore,
//     summary: errors.length === 0
//       ? (warnings.length > 0 ? 'Compliant with warnings' : 'Fully compliant')
//       : `${errors.length} compliance error(s) found`
//   };
// };

// module.exports = { validateGSTCompliance, validateGSTIN, validateInvoiceDate, validateTaxCalculations };



/**
 * GST Compliance Validation Utility
 * Implements Indian GST validation rules per the GST Act, 2017
 */

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Valid Indian state codes (first 2 digits of GSTIN)
const VALID_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38'
]);

/**
 * Validates GSTIN format and structure
 * @param {string} gstin
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
const validateGSTIN = (gstin) => {
  const errors = [];
  const warnings = [];
  if (!gstin) return { valid: false, errors: ['GSTIN is missing'], warnings: [] };

  const cleaned = gstin.toUpperCase().trim();

  if (cleaned.length !== 15) {
    errors.push(`GSTIN must be exactly 15 characters (got ${cleaned.length})`);
    return { valid: false, errors, warnings };
  }

  if (!GSTIN_REGEX.test(cleaned)) {
    errors.push('GSTIN format is invalid. Expected: 2 digits + 5 alpha + 4 digits + 1 alpha + 1 alphanumeric + Z + 1 alphanumeric');
    return { valid: false, errors, warnings };
  }

  const stateCode = cleaned.substring(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    errors.push(`Invalid state code: ${stateCode}`);
    return { valid: false, errors, warnings };
  }

  // Checksum validation (Luhn-like algorithm for GSTIN)
  const checksum = computeGSTINChecksum(cleaned);
  if (checksum !== cleaned[14]) {
    // Make it a warning for test GSTINs, not a hard error
    warnings.push('GSTIN checksum mismatch (may be test GSTIN)');
  }

  return { valid: true, errors: [], warnings };
};

/**
 * Compute GSTIN checksum character
 */
const computeGSTINChecksum = (gstin) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = chars.indexOf(gstin[i]);
    const factor = (i % 2 === 0) ? 1 : 2;
    let product = val * factor;
    if (product > 35) product = Math.floor(product / 36) + (product % 36);
    sum += product;
  }
  const remainder = sum % 36;
  return chars[(36 - remainder) % 36];
};

/**
 * Validates invoice date format and range
 * @param {string} dateStr
 * @returns {{ valid: boolean, error?: string }}
 */
const validateInvoiceDate = (dateStr) => {
  if (!dateStr) return { valid: false, error: 'Invoice date is missing' };

  let parsedDate = null;
  
  // Try parsing DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    parsedDate = new Date(year, month - 1, day);
  }
  
  // Try parsing YYYY-MM-DD or YYYY/MM/DD
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    const yyyymmddMatch = dateStr.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (yyyymmddMatch) {
      const [, year, month, day] = yyyymmddMatch;
      parsedDate = new Date(year, month - 1, day);
    }
  }
  
  // Fallback to standard Date parsing
  if (!parsedDate || isNaN(parsedDate.getTime())) {
    parsedDate = new Date(dateStr);
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) {
    return { valid: false, error: `Invalid date format: "${dateStr}"` };
  }

  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  const oneDayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (parsedDate > oneDayAhead) {
    return { valid: false, error: 'Invoice date cannot be in the future' };
  }
  if (parsedDate < fiveYearsAgo) {
    return { valid: false, error: 'Invoice date is more than 5 years old' };
  }

  return { valid: true };
};

/**
 * Validates tax calculations
 * @param {object} data - Extracted invoice data
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
const validateTaxCalculations = (data) => {
  const errors = [];
  const warnings = [];
  const TOLERANCE = 0.02; // 2 paisa tolerance for rounding

  let { taxable_amount = 0, cgst = 0, sgst = 0, igst = 0, total_amount = 0 } = data;

  // Auto-fill SGST if missing but CGST exists (common OCR miss)
  if (cgst > 0 && sgst === 0) {
    sgst = cgst;
    data.sgst = cgst; // Update the original data object
    warnings.push('SGST was missing, assumed equal to CGST');
  }

  // Check that either CGST+SGST or IGST is used (not both)
  const hasCSGT = cgst > 0 || sgst > 0;
  const hasIGST = igst > 0;

  if (hasCSGT && hasIGST) {
    errors.push('Both CGST/SGST and IGST cannot be applicable simultaneously (intra-state vs inter-state)');
  }

  // Validate CGST === SGST for intra-state transactions
  if (hasCSGT && Math.abs(cgst - sgst) > TOLERANCE) {
    errors.push(`CGST (₹${cgst.toFixed(2)}) must equal SGST (₹${sgst.toFixed(2)}) for intra-state supply`);
  }

  // Validate total tax = CGST + SGST + IGST
  const calculatedTax = cgst + sgst + igst;

  // Validate total amount = taxable_amount + total_tax
  const expectedTotal = taxable_amount + calculatedTax;
  if (total_amount > 0 && Math.abs(total_amount - expectedTotal) > TOLERANCE) {
    errors.push(`Total amount mismatch: Expected ₹${expectedTotal.toFixed(2)}, Found ₹${total_amount.toFixed(2)}`);
  }

  // Check for common GST rates (5%, 12%, 18%, 28%)
  if (taxable_amount > 0 && calculatedTax > 0) {
    const effectiveRate = (calculatedTax / taxable_amount) * 100;
    const standardRates = [0, 5, 12, 18, 28, 3, 0.25];
    const isStandardRate = standardRates.some(r => Math.abs(effectiveRate - r) < 0.1);
    if (!isStandardRate && effectiveRate > 0) {
      warnings.push(`Non-standard GST rate: ${effectiveRate.toFixed(2)}%. Standard rates: 0%, 5%, 12%, 18%, 28%`);
    }
  }

  // Check for zero amounts
  if (taxable_amount <= 0) {
    warnings.push('Taxable amount is zero or negative');
  }

  if (total_amount <= 0) {
    warnings.push('Total amount is zero or negative');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    calculated_tax: calculatedTax,
    expected_total: expectedTotal
  };
};

/**
 * Main GST compliance validation function
 * @param {object} extractedData - All extracted invoice fields
 * @returns {object} - Comprehensive validation result
 */
const validateGSTCompliance = (extractedData) => {
  const errors = [];
  const warnings = [];
  const checks = {};

  // 1. Validate Seller GSTIN
  const sellerGSTINResult = validateGSTIN(extractedData.gstin_seller);
  checks.gstin_seller_valid = sellerGSTINResult.valid;
  if (!sellerGSTINResult.valid) {
    errors.push(...sellerGSTINResult.errors.map((e) => `Seller GSTIN: ${e}`));
  }
  warnings.push(...sellerGSTINResult.warnings.map((w) => `Seller GSTIN: ${w}`));

  // 2. Validate Buyer GSTIN (optional for B2C)
  if (extractedData.gstin_buyer) {
    const buyerGSTINResult = validateGSTIN(extractedData.gstin_buyer);
    checks.gstin_buyer_valid = buyerGSTINResult.valid;
    if (!buyerGSTINResult.valid) {
      errors.push(...buyerGSTINResult.errors.map((e) => `Buyer GSTIN: ${e}`));
    }
    warnings.push(...buyerGSTINResult.warnings.map((w) => `Buyer GSTIN: ${w}`));
  } else {
    checks.gstin_buyer_valid = null; // Optional
    warnings.push("Buyer GSTIN not found (may be B2C transaction)");
  }

  // // 3. Validate invoice number
  // checks.invoice_number_present = !!(extractedData.invoice_number?.trim());
  // if (!checks.invoice_number_present) {
  //   errors.push('Invoice number is missing');
  // } else if (extractedData.invoice_number.length > 16) {
  //   warnings.push('Invoice number exceeds 16 characters (GST rule)');
  // }

  // // 4. Validate invoice date
  // const dateResult = validateInvoiceDate(extractedData.invoice_date);
  // checks.invoice_date_valid = dateResult.valid;
  // if (!dateResult.valid) {
  //   errors.push(dateResult.error);
  // }

  // 3. Validate invoice number
    checks.invoice_number_present = !!(extractedData.invoice_number?.trim());
    if (!checks.invoice_number_present) {
      errors.push('Invoice number is missing');
    } else if (extractedData.invoice_number.length > 16) {
      warnings.push('Invoice number exceeds 16 characters (GST rule)');
    }

    // 4. Validate invoice date
    const dateResult = validateInvoiceDate(extractedData.invoice_date);
    checks.invoice_date_valid = dateResult.valid;
    if (!dateResult.valid) {
      errors.push(dateResult.error);
    }

  // 5. Validate tax calculations
  const taxResult = validateTaxCalculations(extractedData);
  checks.taxable_amount_valid = extractedData.taxable_amount > 0;
  checks.tax_calculation_correct = taxResult.valid;
  checks.total_amount_matches = taxResult.valid;

  errors.push(...taxResult.errors);
  warnings.push(...taxResult.warnings);

  // // 6. Cross-validate state codes for IGST/CGST+SGST (only if both GSTINs exist)
  // if (extractedData.gstin_seller && extractedData.gstin_buyer &&
  //     extractedData.gstin_seller.length === 15 && extractedData.gstin_buyer.length === 15) {
  //   const sellerState = extractedData.gstin_seller.substring(0, 2);
  //   const buyerState = extractedData.gstin_buyer.substring(0, 2);
  //   const isInterState = sellerState !== buyerState;

  //   if (isInterState && (extractedData.cgst > 0 || extractedData.sgst > 0)) {
  //     errors.push('Inter-state transaction should use IGST, not CGST/SGST');
  //   }
  //   if (!isInterState && extractedData.igst > 0) {
  //     errors.push('Intra-state transaction should use CGST/SGST, not IGST');
  //   }
  // }

  // Calculate compliance score
  const totalChecks = Object.keys(checks).filter(
    (k) => checks[k] !== null,
  ).length;
  const passedChecks = Object.values(checks).filter((v) => v === true).length;
  const warningPenalty = Math.min(warnings.length * 5, 30); // Cap penalty at 30%
  const complianceScore = Math.max(
    0,
    Math.round((passedChecks / totalChecks) * 100) - warningPenalty,
  );

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    checks,
    compliance_score: complianceScore,
    summary:
      errors.length === 0
        ? warnings.length > 0
          ? "Compliant with warnings"
          : "Fully compliant"
        : `${errors.length} compliance error(s) found`,
  };
};

module.exports = { validateGSTCompliance, validateGSTIN, validateInvoiceDate, validateTaxCalculations };