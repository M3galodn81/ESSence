export const computeSSS = (grossSalary: number) => {
  // --- Table Constants for 2025 ---
  const MIN_SALARY = 5250;
  const MAX_SALARY = 34749.99;

  const BASE_SS = 250;      // lowest SS
  const MAX_SS = 1000;      // highest SS
  const MAX_MPF = 750;      // highest MPF
  const BRACKET_SIZE = 500;

  // Salary below minimum → minimum SS, no MPF
  if (grossSalary < MIN_SALARY) {
    return BASE_SS;
  }

  // Salary above maximum → max SS + max MPF
  if (grossSalary > MAX_SALARY) {
    return MAX_SS + MAX_MPF;
  }

  // Determine SS (always linearly rising from 250 → 1000)
  const ssSteps = Math.floor((grossSalary - MIN_SALARY) / BRACKET_SIZE);
  const ssValue = Math.min(BASE_SS + ssSteps * 25, MAX_SS);

  // Determine MPF (starts only after 20,250)
  let mpfValue = 0;
  if (grossSalary > 20250) {
    const mpfSteps = Math.floor((grossSalary - 20250) / BRACKET_SIZE);
    mpfValue = Math.min(mpfSteps * 25, MAX_MPF);
  }

  return ssValue + mpfValue;
};


export const computePagIbig = (basic: number) => {
    const rate = basic <= 1500 ? 0.01 : 0.02;
    
    // Maximum contribution is 200, which implies a max salary base of 10,000
    const capped = Math.min(basic, 10000);
    return capped * rate;
  };

  // PhilHealth: 5% (2024/2025) of Basic, shared 50/50. Floor 10k, Ceiling 100k.
export const computePhilHealth = (basic: number) => {
    let income = basic;
    if (income < 10000) income = 10000;
    if (income > 100000) income = 100000;
    return (income * 0.05) / 2; // Employee Share
  };