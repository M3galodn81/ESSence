// 2025 SSS Employee Contribution Table
const sssBrackets = [
  { min: 0,        max: 5249.99,  ms: 5000,  ee: 250 },
  { min: 5250,     max: 5749.99,  ms: 5500,  ee: 275 },
  { min: 5750,     max: 6249.99,  ms: 6000,  ee: 300 },
  { min: 6250,     max: 6749.99,  ms: 6500,  ee: 325 },
  { min: 6750,     max: 7249.99,  ms: 7000,  ee: 350 },
  { min: 7250,     max: 7749.99,  ms: 7500,  ee: 375 },
  { min: 7750,     max: 8249.99,  ms: 8000,  ee: 400 },
  { min: 8250,     max: 8749.99,  ms: 8500,  ee: 425 },
  { min: 8750,     max: 9249.99,  ms: 9000,  ee: 450 },
  { min: 9250,     max: 9749.99,  ms: 9500,  ee: 475 },
  { min: 9750,     max: 10249.99, ms: 10000, ee: 500 },
  { min: 10250,    max: 10749.99, ms: 10500, ee: 525 },
  { min: 10750,    max: 11249.99, ms: 11000, ee: 550 },
  { min: 11250,    max: 11749.99, ms: 11500, ee: 575 },
  { min: 11750,    max: 12249.99, ms: 12000, ee: 600 },
  { min: 12250,    max: 12749.99, ms: 12500, ee: 625 },
  { min: 12750,    max: 13249.99, ms: 13000, ee: 650 },
  { min: 13250,    max: 13749.99, ms: 13500, ee: 675 },
  { min: 13750,    max: 14249.99, ms: 14000, ee: 700 },
  { min: 14250,    max: 14749.99, ms: 14500, ee: 725 },
  { min: 14750,    max: 15249.99, ms: 15000, ee: 750 },
  { min: 15250,    max: 15749.99, ms: 15500, ee: 775 },
  { min: 15750,    max: 16249.99, ms: 16000, ee: 800 },
  { min: 16250,    max: 16749.99, ms: 16500, ee: 825 },
  { min: 16750,    max: 17249.99, ms: 17000, ee: 850 },
  { min: 17250,    max: 17749.99, ms: 17500, ee: 875 },
  { min: 17750,    max: 18249.99, ms: 18000, ee: 900 },
  { min: 18250,    max: 18749.99, ms: 18500, ee: 925 },
  { min: 18750,    max: 19249.99, ms: 19000, ee: 950 },
  { min: 19250,    max: 19749.99, ms: 19500, ee: 975 },
  { min: 19750,    max: 34749.99, ms: 20000, ee: 1000 }
];

export const computeSSS = (grossSalary: number) => {
  const bracket = sssBrackets.find(b =>
    grossSalary >= b.min && grossSalary <= b.max
  );

  // If salary exceeds max table range → max employee contribution
  if (!bracket) return 1000;

  return bracket.ee; // employee share only
};



export const computePagIbig = (basic: number) => {
    const rate = basic <= 1500 ? 0.01 : 0.02;
    
    const capped = Math.min(basic, 10000);
    return capped * rate;
  };

export const computePhilHealth = (basic: number) => {
    let income = basic;
    if (income < 10000) income = 10000;
    if (income > 100000) income = 100000;
    return (income * 0.05) / 2; // Employee Share
  };