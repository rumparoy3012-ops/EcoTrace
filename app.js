/**
 * @file app.js
 * @description EcoTrace - Carbon Footprint Tracker Core Application Logic.
 * Implements real-time footprint calculations, interactive SVG charts,
 * daily budget limits, and milestone savings recognition.
 */

// --- CONSTANTS & CONFIGURATION ---

/**
 * Standard CO2 emissions factors (kg CO2 per unit)
 * @type {{commute: number, electricity: number, transit: number}}
 */
const EMISSION_FACTORS = {
  commute: 0.18,      // per km (average petrol car)
  electricity: 0.40,  // per kWh (average grid mix)
  transit: 0.04       // per km (average bus/train)
};

/**
 * Standard regional average baseline CO2 emissions (kg CO2/day)
 * Used as a reference point to calculate savings.
 * @type {number}
 */
const REGIONAL_BASELINE_CO2 = 20.0;

/**
 * Maximum target daily eco-budget (kg CO2/day)
 * @type {number}
 */
const DAILY_BUDGET_LIMIT_CO2 = 12.0;

// --- DOM ELEMENTS REGISTRY ---

/**
 * Registry containing references to all interactive DOM elements.
 * Evaluated only when running in a browser context.
 * @type {Object<string, HTMLElement|null>}
 */
let elements = {};
if (typeof document !== 'undefined') {
  elements = {
    // Input controls
    commuteSlider: document.getElementById('commute-slider'),
    commuteNumber: document.getElementById('commute-number'),
    electricitySlider: document.getElementById('electricity-slider'),
    electricityNumber: document.getElementById('electricity-number'),
    transitSlider: document.getElementById('transit-slider'),
    transitNumber: document.getElementById('transit-number'),
    
    // Core summary elements
    totalEmissions: document.getElementById('total-emissions'),
    emissionStatus: document.getElementById('emission-status'),
    
    // Category linear progress breakdown values
    valCommute: document.getElementById('val-commute'),
    valElectricity: document.getElementById('val-electricity'),
    valTransit: document.getElementById('val-transit'),
    
    // Category linear progress breakdown bar fills
    barCommute: document.querySelector('.fill-commute'),
    barElectricity: document.querySelector('.fill-electricity'),
    barTransit: document.querySelector('.fill-transit'),
    
    // Dynamic SVG chart groups
    chartSegments: document.getElementById('chart-segments'),
    
    // AI Eco-Mentor section
    aiAdviceWrapper: document.getElementById('ai-advice-wrapper'),
    
    // Logging and streak widgets
    streakCount: document.getElementById('streak-count'),
    saveLogBtn: document.getElementById('save-log-btn'),
    
    // NEW: Milestone savings elements
    milestoneBanner: document.getElementById('milestone-banner'),
    milestoneSavingsVal: document.getElementById('milestone-savings-val'),
    
    // NEW: Daily budget elements
    budgetCard: document.getElementById('budget-card'),
    budgetStatus: document.getElementById('budget-status'),
    budgetProgressFill: document.getElementById('budget-progress-fill'),
    budgetRemaining: document.getElementById('budget-remaining')
  };
}

// --- APP STATE ---

/**
 * Global application state.
 * @type {{inputs: {commute: number, electricity: number, transit: number}, streak: number, lastLoggedDate: string|null}}
 */
let state = {
  inputs: {
    commute: 25,
    electricity: 12,
    transit: 15
  },
  streak: 0,
  lastLoggedDate: null
};

// --- ICON DATASETS ---

/**
 * Inline SVGs for the dynamic AI recommendations panel.
 * @type {Object<string, string>}
 */
const ICONS = {
  car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
  plug: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`,
  transit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/></svg>`,
  bike: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M5.5 17.5 12 6.5l2.5 4.5H20M12 6.5h4"/><path d="M14.5 11 12 17.5H9"/></svg>`,
  leaf: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.5 1 9.8a7 7 0 0 1-9 8.2Z"/><path d="M9 10a.5.5 0 0 0-1 0v4a.5.5 0 0 0 1 0Z"/><path d="m14 13 .5.5"/><path d="M12 16a3 3 0 0 0-3-3"/></svg>`,
  sun: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
};

// --- DATA VALIDATION UTILITIES ---

/**
 * Validates, cleans, and constrains a generic input number.
 * @param {string|number} value - Raw input value.
 * @param {number} min - Minimum allowed boundary.
 * @param {number} max - Maximum allowed boundary.
 * @param {number} defaultValue - Fallback value if parsing fails.
 * @returns {number} Cleaned, bounded number.
 */
function validateNumber(value, min, max, defaultValue) {
  let parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  if (parsed < min) parsed = min;
  if (parsed > max) parsed = max;
  return parsed;
}

// --- CORE MATHEMATICAL CALCULATIONS ---

/**
 * Pure function to calculate carbon emissions from lifestyle categories.
 * @param {number} commute - Private car travel in km.
 * @param {number} electricity - Electricity usage in kWh.
 * @param {number} transit - Public transport travel in km.
 * @returns {{commuteCO2: number, electricityCO2: number, transitCO2: number, totalCO2: number}} Calculated values.
 */
function calculateEmissions(commute, electricity, transit) {
  const commuteCO2 = commute * EMISSION_FACTORS.commute;
  const electricityCO2 = electricity * EMISSION_FACTORS.electricity;
  const transitCO2 = transit * EMISSION_FACTORS.transit;
  const totalCO2 = commuteCO2 + electricityCO2 + transitCO2;
  
  return {
    commuteCO2,
    electricityCO2,
    transitCO2,
    totalCO2
  };
}

// --- UI RENDERING & RENDERING UTILITIES ---

/**
 * Sets the active sliding background track fill percentage.
 * @param {HTMLInputElement} slider - Slider element reference.
 * @param {number} val - Current selected value.
 * @param {number} max - Max range value.
 * @returns {void}
 */
function updateSliderProgressFill(slider, val, max) {
  if (!slider) return;
  const percentage = (val / max) * 100;
  slider.style.setProperty(`--${slider.id.split('-')[0]}-pct`, `${percentage}%`);
}

/**
 * Synchronizes values between dual slider and number input fields.
 * @param {string} category - Category prefix ('commute', 'electricity', 'transit').
 * @param {number} value - Updated numerical value.
 * @param {number} max - Maximum boundary limit.
 * @returns {void}
 */
function syncInputs(category, value, max) {
  const slider = elements[`${category}Slider`];
  const number = elements[`${category}Number`];
  
  if (slider) {
    slider.value = Math.min(value, max);
    updateSliderProgressFill(slider, Math.min(value, max), max);
  }
  if (number) {
    number.value = value;
  }
}

/**
 * Updates status badge indicator class based on emission levels.
 * @param {number} totalCO2 - Total daily emissions in kg.
 * @returns {void}
 */
function updateStatusBadge(totalCO2) {
  const ratingElement = elements.emissionStatus;
  if (!ratingElement) return;

  ratingElement.className = 'emission-rating';
  
  if (totalCO2 < 8) {
    ratingElement.innerText = 'Low';
    ratingElement.classList.add('badge-low');
  } else if (totalCO2 <= 18) {
    ratingElement.innerText = 'Moderate';
    ratingElement.classList.add('badge-medium');
  } else {
    ratingElement.innerText = 'High';
    ratingElement.classList.add('badge-high');
  }
}

/**
 * Redraws and animates the SVG segments on the doughnut chart.
 * @param {number} commuteVal - Commute emissions in kg.
 * @param {number} electricityVal - Electricity emissions in kg.
 * @param {number} transitVal - Public transit emissions in kg.
 * @param {number} totalVal - Total emissions in kg.
 * @returns {void}
 */
function updateChart(commuteVal, electricityVal, transitVal, totalVal) {
  if (!elements.chartSegments) return;
  
  elements.chartSegments.innerHTML = '';
  if (totalVal === 0) return;
  
  const radius = 75;
  const circumference = 2 * Math.PI * radius; // 471.24
  
  const shares = [
    { name: 'commute', val: commuteVal, color: 'var(--cat-commute)' },
    { name: 'electricity', val: electricityVal, color: 'var(--cat-electricity)' },
    { name: 'transit', val: transitVal, color: 'var(--cat-transit)' }
  ];
  
  let accumulatedOffset = 0;
  
  shares.forEach(share => {
    if (share.val <= 0) return;
    
    const percentage = share.val / totalVal;
    const strokeDash = percentage * circumference;
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', `chart-segment segment-${share.name}`);
    circle.setAttribute('cx', '100');
    circle.setAttribute('cy', '100');
    circle.setAttribute('r', radius.toString());
    circle.setAttribute('stroke', share.color);
    circle.setAttribute('stroke-dasharray', `${strokeDash} ${circumference}`);
    circle.setAttribute('stroke-dashoffset', (-accumulatedOffset).toString());
    
    elements.chartSegments.appendChild(circle);
    accumulatedOffset += strokeDash;
  });
}

/**
 * Updates the Daily Eco-Budget Card with metrics and warning states.
 * @param {number} totalCO2 - Total daily emissions in kg.
 * @returns {void}
 */
function updateBudgetUI(totalCO2) {
  if (!elements.budgetCard) return;

  const budgetPct = Math.min((totalCO2 / DAILY_BUDGET_LIMIT_CO2) * 100, 100);
  const remaining = DAILY_BUDGET_LIMIT_CO2 - totalCO2;
  
  // Progress Bar Fill
  if (elements.budgetProgressFill) {
    elements.budgetProgressFill.style.width = `${budgetPct}%`;
    elements.budgetProgressFill.className = 'budget-progress-fill ' + 
      (totalCO2 <= DAILY_BUDGET_LIMIT_CO2 ? 'fill-pass' : 'fill-fail');
  }

  // Footer status description
  if (elements.budgetRemaining) {
    if (remaining >= 0) {
      elements.budgetRemaining.innerHTML = `Left: <strong>${remaining.toFixed(1)}</strong> kg`;
    } else {
      elements.budgetRemaining.innerHTML = `Over: <strong style="color:var(--danger)">${Math.abs(remaining).toFixed(1)}</strong> kg`;
    }
  }

  // Status Badge Indicator
  if (elements.budgetStatus) {
    elements.budgetStatus.className = 'budget-status';
    if (totalCO2 <= DAILY_BUDGET_LIMIT_CO2) {
      elements.budgetStatus.innerText = 'Within Budget';
      elements.budgetStatus.classList.add('badge-low');
    } else {
      elements.budgetStatus.innerText = 'Exceeded';
      elements.budgetStatus.classList.add('badge-high');
    }
  }
}

/**
 * Calculates and manages the visibility and animation of the milestone savings banner.
 * Shows exactly how many kg of CO2 have been saved compared to the baseline.
 * @param {number} totalCO2 - Total daily emissions in kg.
 * @returns {void}
 */
function updateMilestoneBanner(totalCO2) {
  if (!elements.milestoneBanner) return;

  const savings = REGIONAL_BASELINE_CO2 - totalCO2;
  
  if (savings > 0) {
    if (elements.milestoneSavingsVal) {
      elements.milestoneSavingsVal.innerText = savings.toFixed(1);
    }
    
    // Show banner with animation
    elements.milestoneBanner.classList.remove('hidden');
    elements.milestoneBanner.style.opacity = '1';
    elements.milestoneBanner.style.transform = 'translateY(0)';
  } else {
    // Hide banner
    elements.milestoneBanner.style.opacity = '0';
    elements.milestoneBanner.style.transform = 'translateY(-10px)';
    
    // Wrap timeout to fully hide from document flow after transition
    setTimeout(() => {
      if (REGIONAL_BASELINE_CO2 - state.inputs.commute * EMISSION_FACTORS.commute - state.inputs.electricity * EMISSION_FACTORS.electricity - state.inputs.transit * EMISSION_FACTORS.transit <= 0) {
        elements.milestoneBanner.classList.add('hidden');
      }
    }, 500);
  }
}

/**
 * Coordinator function to trigger calculations, updates, and templates generation.
 * @returns {void}
 */
function updateCalculations() {
  // 1. Core formula calculations
  const { commuteCO2, electricityCO2, transitCO2, totalCO2 } = calculateEmissions(
    state.inputs.commute,
    state.inputs.electricity,
    state.inputs.transit
  );
  
  if (typeof document === 'undefined') return; // Exit early if test runner environment

  // 2. Render totals
  if (elements.totalEmissions) elements.totalEmissions.innerText = totalCO2.toFixed(1);
  if (elements.valCommute) elements.valCommute.innerText = `${commuteCO2.toFixed(1)} kg`;
  if (elements.valElectricity) elements.valElectricity.innerText = `${electricityCO2.toFixed(1)} kg`;
  if (elements.valTransit) elements.valTransit.innerText = `${transitCO2.toFixed(1)} kg`;
  
  // 3. Update category progress bar ratios
  const maxCategory = Math.max(commuteCO2, electricityCO2, transitCO2, 1);
  if (elements.barCommute) elements.barCommute.style.width = `${(commuteCO2 / maxCategory) * 100}%`;
  if (elements.barElectricity) elements.barElectricity.style.width = `${(electricityCO2 / maxCategory) * 100}%`;
  if (elements.barTransit) elements.barTransit.style.width = `${(transitCO2 / maxCategory) * 100}%`;
  
  // 4. Update modular UI sections
  updateStatusBadge(totalCO2);
  updateChart(commuteCO2, electricityCO2, transitCO2, totalCO2);
  updateBudgetUI(totalCO2);
  updateMilestoneBanner(totalCO2);
  generateAIAdvice(commuteCO2, electricityCO2, transitCO2);
}

// --- DYNAMIC AI ECO-ADVISOR ---

/**
 * Generates and templates advice panels in real-time based on the highest category.
 * @param {number} commuteVal - Commute emissions.
 * @param {number} electricityVal - Electricity emissions.
 * @param {number} transitVal - Public transit emissions.
 * @returns {void}
 */
function generateAIAdvice(commuteVal, electricityVal, transitVal) {
  if (!elements.aiAdviceWrapper) return;

  const max = Math.max(commuteVal, electricityVal, transitVal);
  let html = '';
  
  if (commuteVal === 0 && electricityVal === 0 && transitVal === 0) {
    html = `
      <div class="ai-advice-focus">Perfect Zero Footprint!</div>
      <div class="tips-container">
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.leaf}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Eco Champion Status</span>
              <span class="saving-badge">Active</span>
            </div>
            <p class="tip-text">You have reported no activities that generate CO₂ today. Keep up this sustainable way of living and keep tracking to build your streak!</p>
          </div>
        </div>
      </div>
    `;
    elements.aiAdviceWrapper.innerHTML = html;
    return;
  }
  
  if (max === commuteVal) {
    const potentialSaving = (state.inputs.commute * 0.5 * (EMISSION_FACTORS.commute - EMISSION_FACTORS.transit)).toFixed(1);
    html = `
      <div class="ai-advice-focus">Priority Focus: Reduce Vehicle Commute Impact</div>
      <div class="tips-container">
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.transit}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Switch to Public Transport</span>
              <span class="saving-badge">Save ~${potentialSaving} kg CO₂</span>
            </div>
            <p class="tip-text">By shifting just half of your daily vehicle commute (${(state.inputs.commute * 0.5).toFixed(0)} km) to bus, train, or light rail, you cut your travel footprint substantially.</p>
          </div>
        </div>
        
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.bike}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Active Commuting (Bike & Walk)</span>
              <span class="saving-badge">Save up to 100%</span>
            </div>
            <p class="tip-text">Try walking or cycling for short neighborhood errands under 4km. It generates absolute zero greenhouse emissions and keeps you active.</p>
          </div>
        </div>
        
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.car}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Carpooling & Smooth Driving</span>
              <span class="saving-badge">Save ~20-50%</span>
            </div>
            <p class="tip-text">Coordinating rides with a colleague slices vehicle emissions in half. Avoid sudden accelerations and excess highway speeds to save fuel.</p>
          </div>
        </div>
      </div>
    `;
  } else if (max === electricityVal) {
    const savingLed = (state.inputs.electricity * 0.15 * EMISSION_FACTORS.electricity).toFixed(1);
    const savingTemp = (state.inputs.electricity * 0.10 * EMISSION_FACTORS.electricity).toFixed(1);
    
    html = `
      <div class="ai-advice-focus">Priority Focus: Optimize Home Energy Efficiency</div>
      <div class="tips-container">
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.plug}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Kill Standby Power ("Vampire Draw")</span>
              <span class="saving-badge">Save ~${savingLed} kg CO₂</span>
            </div>
            <p class="tip-text">Standby power draws on computers, TVs, and appliances account for up to 15% of regular home energy bills. Unplug them or use power strips.</p>
          </div>
        </div>
        
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.sun}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Thermostat & Insulation Adjustments</span>
              <span class="saving-badge">Save ~${savingTemp} kg CO₂</span>
            </div>
            <p class="tip-text">Setting heating 1-2°C lower in winter or cooling higher in summer reduces HVAC load. Ensure doors and windows are sealed against air leaks.</p>
          </div>
        </div>
        
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.leaf}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Switch to LEDs and Energy Star</span>
              <span class="saving-badge">Long-term Savings</span>
            </div>
            <p class="tip-text">LEDs consume up to 80% less energy than old incandescent bulbs. When purchasing appliances, prioritize high Energy Star performance indices.</p>
          </div>
        </div>
      </div>
    `;
  } else {
    const transitSaving = (state.inputs.transit * 0.15 * EMISSION_FACTORS.transit).toFixed(2);
    html = `
      <div class="ai-advice-focus">Priority Focus: Consolidate Commute Volume</div>
      <div class="tips-container">
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.bike}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Last-Mile Cycling or Walking</span>
              <span class="saving-badge">Save ~${transitSaving} kg CO₂</span>
            </div>
            <p class="tip-text">Your public transit usage is significant. Commuting by foot or light bike for short-distance routes (under 2 km) eliminates last-mile transit requirements.</p>
          </div>
        </div>
        
        <div class="tip-item">
          <div class="tip-icon-box">${ICONS.leaf}</div>
          <div class="tip-body">
            <div class="tip-title-row">
              <span class="tip-title">Consolidate Errands</span>
              <span class="saving-badge">Low Impact</span>
            </div>
            <p class="tip-text">Group remote chores into targeted multi-stop paths rather than making multiple individual transit journeys throughout the week.</p>
          </div>
        </div>
      </div>
    `;
  }
  
  elements.aiAdviceWrapper.innerHTML = html;
}

// --- INPUT EVENT CONTROLLERS ---

/**
 * Handles validation and state updates when range/numeric inputs change.
 * @param {string} category - Category key ('commute', 'electricity', 'transit').
 * @param {string|number} rawValue - Raw string or numeric input value.
 * @param {number} max - Bound constraint limit.
 * @returns {void}
 */
function handleInputChange(category, rawValue, max) {
  const cleanValue = validateNumber(rawValue, 0, 999, state.inputs[category]);
  
  state.inputs[category] = cleanValue;
  localStorage.setItem('ecotrace_inputs', JSON.stringify(state.inputs));
  
  syncInputs(category, cleanValue, max);
  updateCalculations();
}

/**
 * Sets up bidirectional event listeners on form range and numeric controllers.
 * @returns {void}
 */
function setupInputListeners() {
  const configurations = [
    { key: 'commute', max: 150 },
    { key: 'electricity', max: 50 },
    { key: 'transit', max: 100 }
  ];

  configurations.forEach(cfg => {
    const slider = elements[`${cfg.key}Slider`];
    const number = elements[`${cfg.key}Number`];
    
    if (slider) {
      slider.addEventListener('input', (e) => {
        handleInputChange(cfg.key, e.target.value, cfg.max);
      });
    }
    
    if (number) {
      number.addEventListener('input', (e) => {
        handleInputChange(cfg.key, e.target.value, cfg.max);
      });
    }
  });
}

// --- STATE PERSISTENCE & STREAK LOGGING ---

/**
 * Validates whether the user kept up their daily streak.
 * Resets streak count if user skipped logging for more than 1 day.
 * @returns {void}
 */
function checkStreakValidity() {
  if (!state.lastLoggedDate) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastLogged = new Date(state.lastLoggedDate);
  lastLogged.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(today - lastLogged);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays > 1) {
    state.streak = 0;
    localStorage.setItem('ecotrace_streak', 0);
  }
}

/**
 * Restores input history and streak stats from local storage configurations.
 * @returns {void}
 */
function initAppState() {
  const storedInputs = localStorage.getItem('ecotrace_inputs');
  if (storedInputs) {
    try {
      state.inputs = JSON.parse(storedInputs);
    } catch (e) {
      console.error("Failed to parse inputs from local storage", e);
    }
  }
  
  const storedStreak = localStorage.getItem('ecotrace_streak');
  if (storedStreak) {
    state.streak = parseInt(storedStreak, 10) || 0;
  }
  
  state.lastLoggedDate = localStorage.getItem('ecotrace_last_logged');
  checkStreakValidity();
  
  // Populate starting UI elements
  if (elements.streakCount) elements.streakCount.innerText = state.streak;
  syncInputs('commute', state.inputs.commute, 150);
  syncInputs('electricity', state.inputs.electricity, 50);
  syncInputs('transit', state.inputs.transit, 100);
}

/**
 * Triggers feedback animations and colors change on logging button and streak badges.
 * @returns {void}
 */
function triggerStreakAnimation() {
  const badge = document.getElementById('streak-badge');
  if (badge) {
    badge.style.transform = 'scale(1.25)';
    badge.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.8)';
  }
  
  if (elements.saveLogBtn) {
    elements.saveLogBtn.classList.remove('btn-primary');
    elements.saveLogBtn.style.background = 'linear-gradient(135deg, #059669, #047857)';
    elements.saveLogBtn.style.color = '#ffffff';
    elements.saveLogBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Footprint Saved!
    `;
  }
  
  setTimeout(() => {
    if (badge) {
      badge.style.transform = '';
      badge.style.boxShadow = '';
    }
    
    if (elements.saveLogBtn) {
      elements.saveLogBtn.classList.add('btn-primary');
      elements.saveLogBtn.style.background = '';
      elements.saveLogBtn.style.color = '';
      elements.saveLogBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Log Today's Footprint
      `;
    }
  }, 2000);
}

/**
 * Handles footprint logging commits and calculates streak increases.
 * @returns {void}
 */
function logDailyFootprint() {
  const today = new Date();
  const todayStr = today.toDateString();
  
  if (state.lastLoggedDate === todayStr) {
    alert("You've already logged your footprint for today! Keep up the good work.");
    return;
  }
  
  if (state.lastLoggedDate) {
    const lastLogged = new Date(state.lastLoggedDate);
    lastLogged.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    if (lastLogged.getTime() === yesterday.getTime()) {
      state.streak += 1;
    } else {
      state.streak = 1;
    }
  } else {
    state.streak = 1;
  }
  
  state.lastLoggedDate = todayStr;
  
  localStorage.setItem('ecotrace_streak', state.streak);
  localStorage.setItem('ecotrace_last_logged', todayStr);
  
  if (elements.streakCount) elements.streakCount.innerText = state.streak;
  triggerStreakAnimation();
}

/**
 * Binds click handler for the Logging Commit button.
 * @returns {void}
 */
function setupStreakLogging() {
  if (elements.saveLogBtn) {
    elements.saveLogBtn.addEventListener('click', logDailyFootprint);
  }
}

// --- INITIALIZATION GATEWAY ---

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initAppState();
    setupInputListeners();
    setupStreakLogging();
    updateCalculations();
  });
}

// --- NODE.JS EXPORTS FOR UNIT TESTING ---

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    calculateEmissions,
    EMISSION_FACTORS,
    REGIONAL_BASELINE_CO2,
    DAILY_BUDGET_LIMIT_CO2,
    validateNumber
  };
}
