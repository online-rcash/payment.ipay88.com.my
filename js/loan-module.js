(function () {
  const shell = document.getElementById('loanDashboard');
  if (!shell) return;

  const state = {
    amount: 30000,
    tenure: 24,
    userId: 'guest-user',
    step: 0,
    loanStatus: []
  };

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function getMonthlyEstimate() {
    const principal = Number(state.amount || 0);
    const months = Number(state.tenure || 1);
    const rate = 0.055 / 12;
    const factor = Math.pow(1 + rate, months);
    const installment = (principal * rate * factor) / (factor - 1);
    return Math.max(installment, principal / months);
  }

  function renderStatus() {
    const statusItems = state.loanStatus.length
      ? state.loanStatus
      : [
          { label: 'Submitted', active: true, done: true },
          { label: 'Under Review', active: false, done: false },
          { label: 'Approved', active: false, done: false },
          { label: 'Disbursed', active: false, done: false }
        ];

    return statusItems.map((item, index) => `
      <div class="loan-status-item ${item.active ? 'is-active' : ''} ${item.done ? 'is-done' : ''}">
        <span class="loan-status-dot">${index + 1}</span>
        <span>${item.label}</span>
      </div>
    `).join('');
  }

  function render() {
    const monthly = getMonthlyEstimate();
    shell.innerHTML = `
      <section class="rcash-loan-card">
        <div class="loan-header-row">
          <div>
            <p class="loan-kicker">Loan Hub</p>
            <h2>Smart Personal Financing</h2>
          </div>
          <span class="loan-badge">Live Estimate</span>
        </div>

        <div class="loan-hero-grid">
          <div class="loan-calc-panel">
            <div class="loan-range-wrap">
              <div class="loan-label-row">
                <span>Loan Amount</span>
                <strong>${formatCurrency(state.amount)}</strong>
              </div>
              <input id="loanAmountRange" type="range" min="5000" max="200000" step="1000" value="${state.amount}" aria-label="Loan amount" />
            </div>

            <div class="loan-range-wrap">
              <div class="loan-label-row">
                <span>Tenure</span>
                <strong>${state.tenure} months</strong>
              </div>
              <input id="loanTenureRange" type="range" min="6" max="84" step="1" value="${state.tenure}" aria-label="Loan tenure" />
            </div>

            <div class="loan-amount-boxes">
              <div>
                <span>Monthly Installment</span>
                <strong>${formatCurrency(monthly)}</strong>
              </div>
              <div>
                <span>Estimated APR</span>
                <strong>5.5% p.a.</strong>
              </div>
            </div>
          </div>

          <div class="loan-summary-panel">
            <p class="loan-summary-kicker">Quick Summary</p>
            <ul>
              <li><span>Principal</span><strong>${formatCurrency(state.amount)}</strong></li>
              <li><span>Tenure</span><strong>${state.tenure} Months</strong></li>
              <li><span>Est. Monthly</span><strong>${formatCurrency(monthly)}</strong></li>
            </ul>
            <button type="button" class="loan-primary-button" data-action="jump-form">Apply Now</button>
          </div>
        </div>

        <div class="loan-progress-wrap">
          ${renderStatus()}
        </div>

        <form id="loanApplicationForm" class="loan-application-form">
          <div class="loan-step-header">
            <p>Application</p>
            <h3>Step ${state.step + 1} of 4</h3>
          </div>

          <div class="loan-step-panel ${state.step === 0 ? 'is-visible' : ''}" data-step="0">
            <div class="loan-form-grid">
              <label>
                <span>Full Name</span>
                <input type="text" name="fullName" required placeholder="Ali bin Abu" />
              </label>
              <label>
                <span>IC Number</span>
                <input type="text" name="icNumber" required placeholder="000000-00-0000" />
              </label>
              <label>
                <span>Phone</span>
                <input type="tel" name="phone" required placeholder="0123456789" />
              </label>
              <label>
                <span>Address</span>
                <textarea name="address" rows="3" required placeholder="Full residential address"></textarea>
              </label>
            </div>
          </div>

          <div class="loan-step-panel ${state.step === 1 ? 'is-visible' : ''}" data-step="1">
            <div class="loan-form-grid">
              <label>
                <span>Employer</span>
                <input type="text" name="employer" required placeholder="Company name" />
              </label>
              <label>
                <span>Occupation</span>
                <input type="text" name="occupation" required placeholder="Occupation" />
              </label>
              <label>
                <span>Monthly Income</span>
                <input type="number" name="monthlyIncome" required placeholder="3500" />
              </label>
            </div>
          </div>

          <div class="loan-step-panel ${state.step === 2 ? 'is-visible' : ''}" data-step="2">
            <div class="loan-form-grid">
              <label>
                <span>Bank Name</span>
                <input type="text" name="bankName" required placeholder="Maybank" />
              </label>
              <label>
                <span>Account Number</span>
                <input type="text" name="bankAccount" required placeholder="123456789012" />
              </label>
              <label class="loan-upload-box">
                <span>IC / Payslip</span>
                <input type="file" name="documents" multiple />
              </label>
            </div>
          </div>

          <div class="loan-step-panel ${state.step === 3 ? 'is-visible' : ''}" data-step="3">
            <div class="loan-review-box">
              <div><span>Requested Amount</span><strong>${formatCurrency(state.amount)}</strong></div>
              <div><span>Tenure</span><strong>${state.tenure} months</strong></div>
              <div><span>Monthly Installment</span><strong>${formatCurrency(monthly)}</strong></div>
              <label class="terms-row">
                <input type="checkbox" name="terms" required />
                <span>I agree to the loan terms and consent to verification.</span>
              </label>
            </div>
          </div>

          <div class="loan-actions">
            <button type="button" class="loan-secondary-button" data-action="prev-step" ${state.step === 0 ? 'disabled' : ''}>Back</button>
            <button type="button" class="loan-primary-button" data-action="next-step">
              ${state.step === 3 ? 'Submit Application' : 'Continue'}
            </button>
          </div>
        </form>
      </section>
    `;

    const amountRange = document.getElementById('loanAmountRange');
    const tenureRange = document.getElementById('loanTenureRange');
    if (amountRange) {
      amountRange.addEventListener('input', (event) => {
        state.amount = Number(event.target.value || 0);
        render();
      });
    }

    if (tenureRange) {
      tenureRange.addEventListener('input', (event) => {
        state.tenure = Number(event.target.value || 1);
        render();
      });
    }

    shell.querySelector('[data-action="jump-form"]').addEventListener('click', () => {
      state.step = 0;
      render();
      document.getElementById('loanApplicationForm')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    shell.querySelector('[data-action="prev-step"]').addEventListener('click', () => {
      if (state.step > 0) {
        state.step -= 1;
        render();
      }
    });

    shell.querySelector('[data-action="next-step"]').addEventListener('click', async (event) => {
      event.preventDefault();
      if (state.step < 3) {
        state.step += 1;
        render();
        return;
      }

      const form = document.getElementById('loanApplicationForm');
      if (!form || !form.reportValidity()) return;

      const formData = new FormData(form);
      const payload = {
        userId: state.userId,
        amount: Number(state.amount),
        tenure: Number(state.tenure),
        summary: {
          fullName: formData.get('fullName'),
          icNumber: formData.get('icNumber'),
          phone: formData.get('phone'),
          address: formData.get('address'),
          employer: formData.get('employer'),
          occupation: formData.get('occupation'),
          monthlyIncome: formData.get('monthlyIncome'),
          bankName: formData.get('bankName'),
          bankAccount: formData.get('bankAccount')
        }
      };

      try {
        const api = window.RCASH_API;
        const result = api ? await api.applyLoan(payload) : { success: true, applicationId: 'demo_' + Date.now(), status: 'Submitted' };

        const message = document.createElement('div');
        message.className = 'loan-submit-message';
        message.textContent = result.success
          ? `Application submitted successfully. Reference: ${result.applicationId || 'LOAN-NEW'}`
          : 'Unable to submit application right now.';
        form.appendChild(message);
      } catch (error) {
        const message = document.createElement('div');
        message.className = 'loan-submit-message error';
        message.textContent = 'Your application could not be submitted. Please check your app configuration.';
        form.appendChild(message);
      }
    });
  }

  render();
})();
