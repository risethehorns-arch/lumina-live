// LUMINA — valuation.js
// Multi-step valuation form logic for the property valuation page.

(function () {
  'use strict';

  // State
  let currentStep = 1;
  const totalSteps = 3;

  // Elements
  const form = document.getElementById('valuation-form');
  const steps = document.querySelectorAll('.step-content');
  const progressSteps = document.querySelectorAll('.progress-step');
  const progressLine = document.getElementById('progress-line');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const propTypeInput = document.getElementById('prop-type');
  const typeButtons = document.querySelectorAll('.selector-btn');

  // Handle Selector Buttons
  typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      typeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      propTypeInput.value = btn.dataset.value;
    });
  });

  // Navigation functions
  function updateProgress() {
    const widthPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    progressLine.style.width = `${widthPercent}%`;

    progressSteps.forEach((el, index) => {
      const stepNum = index + 1;
      if (stepNum <= currentStep) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  function showStep(stepNum) {
    steps.forEach(step => {
      if (Number(step.dataset.step) === stepNum) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    if (stepNum === 1) {
      btnPrev.style.visibility = 'hidden';
    } else {
      btnPrev.style.visibility = 'visible';
    }

    if (stepNum === totalSteps) {
      btnNext.textContent = 'Submit Mandate';
    } else {
      btnNext.textContent = 'Next Step';
    }

    currentStep = stepNum;
    updateProgress();
  }

  function validateStep(stepNum) {
    const activeStepEl = document.querySelector(`.step-content[data-step="${stepNum}"]`);
    const requiredInputs = activeStepEl.querySelectorAll('[required]');
    let isValid = true;

    requiredInputs.forEach(input => {
      if (!input.value.trim()) {
        isValid = false;
        input.style.borderColor = 'red';
        input.addEventListener('input', () => {
          input.style.borderColor = '';
        }, { once: true });
      }
    });

    return isValid;
  }

  // Submit handler
  function submitValuation() {
    const type = propTypeInput.value;
    const area = document.getElementById('prop-area').value;
    const size = document.getElementById('prop-size').value;
    const bedrooms = document.getElementById('prop-bedrooms').value;
    const bathrooms = document.getElementById('prop-bathrooms').value;
    const notes = document.getElementById('prop-notes').value;
    
    const features = [];
    document.querySelectorAll('input[name="features"]:checked').forEach(cb => {
      features.push(cb.value);
    });

    const name = document.getElementById('owner-name').value;
    const phone = document.getElementById('owner-phone').value;
    const email = document.getElementById('owner-email').value;

    const messageLines = [
      'Hello Lumina, I would like to request a private valuation advisory:',
      '',
      `*Property Core Details:*`,
      `- Property Type: ${type}`,
      `- Neighborhood: ${area}`,
      `- Size: ${size} sqm`,
      `- Beds/Baths: ${bedrooms} Bed, ${bathrooms} Bath`,
    ];

    if (features.length > 0) {
      messageLines.push(`- Amenities: ${features.join(', ')}`);
    }
    if (notes.trim()) {
      messageLines.push(`- Notes: ${notes.trim()}`);
    }

    messageLines.push(
      '',
      `*Owner Info:*`,
      `- Name: ${name}`,
      `- Contact Phone: ${phone}`,
      `- Email: ${email}`
    );

    const messageText = messageLines.join('\n');
    console.log('Valuation Request Form Submitted:', { type, area, size, name, phone, email });

    const whatsappNumber = (window.LuminaConfig && window.LuminaConfig.whatsapp) || '962791234567';
    const redirectUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageText)}`;

    window.open(redirectUrl, '_blank');
  }

  // Listeners
  btnNext.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        showStep(currentStep + 1);
      } else {
        submitValuation();
      }
    }
  });

  btnPrev.addEventListener('click', () => {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
  });

})();
