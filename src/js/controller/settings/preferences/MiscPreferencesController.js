(function () {
  var ns = $.namespace('pskl.controller.settings.preferences');

  ns.MiscPreferencesController = function (piskelController, preferencesController) {
    this.piskelController = piskelController;
    this.preferencesController = preferencesController;
  };

  pskl.utils.inherit(ns.MiscPreferencesController, pskl.controller.settings.AbstractSettingController);

  ns.MiscPreferencesController.prototype.init = function () {
    // NES Mode toggle
    var nesModeCheckbox = document.querySelector('.nes-mode-checkbox');
    nesModeCheckbox.checked = pskl.UserSettings.get(pskl.UserSettings.NES_MODE);
    this.addEventListener(nesModeCheckbox, 'change', this.onNESModeChange_);

    // NES Color Replace Prompt toggle
    var colorReplaceCheckbox = document.querySelector(
      '.nes-color-replace-prompt-checkbox');
    if (colorReplaceCheckbox) {
      colorReplaceCheckbox.checked = pskl.UserSettings.get(
        pskl.UserSettings.NES_COLOR_REPLACE_PROMPT);
      this.addEventListener(
        colorReplaceCheckbox, 'change', this.onColorReplacePromptChange_);
    }

    this.backgroundContainer = document.querySelector('.background-picker-wrapper');
    this.addEventListener(this.backgroundContainer, 'click', this.onBackgroundClick_);

    // Highlight selected background :
    var background = pskl.UserSettings.get(pskl.UserSettings.CANVAS_BACKGROUND);
    var selectedBackground = this.backgroundContainer.querySelector('[data-background=' + background + ']');
    if (selectedBackground) {
      selectedBackground.classList.add('selected');
    }

    // Max FPS
    var maxFpsInput = document.querySelector('.max-fps-input');
    maxFpsInput.value = pskl.UserSettings.get(pskl.UserSettings.MAX_FPS);
    this.addEventListener(maxFpsInput, 'change', this.onMaxFpsChange_);

    // Color format
    var colorFormat = pskl.UserSettings.get(pskl.UserSettings.COLOR_FORMAT);
    var colorFormatSelect = document.querySelector('.color-format-select');
    var selectedColorFormatOption = colorFormatSelect.querySelector('option[value="' + colorFormat + '"]');
    if (selectedColorFormatOption) {
      selectedColorFormatOption.setAttribute('selected', 'selected');
    }
    this.addEventListener(colorFormatSelect, 'change', this.onColorFormatChange_);

    // Layer preview opacity
    var layerOpacityInput = document.querySelector('.layer-opacity-input');
    layerOpacityInput.value = pskl.UserSettings.get(pskl.UserSettings.LAYER_OPACITY);
    this.addEventListener(layerOpacityInput, 'change', this.onLayerOpacityChange_);
    this.addEventListener(layerOpacityInput, 'input', this.onLayerOpacityChange_);
    this.updateLayerOpacityText_(layerOpacityInput.value);
  };

  ns.MiscPreferencesController.prototype.onBackgroundClick_ = function (evt) {
    var target = evt.target;
    var background = target.dataset.background;
    if (background) {
      pskl.UserSettings.set(pskl.UserSettings.CANVAS_BACKGROUND, background);
      var selected = this.backgroundContainer.querySelector('.selected');
      if (selected) {
        selected.classList.remove('selected');
      }
      target.classList.add('selected');
    }
  };

  ns.MiscPreferencesController.prototype.onColorFormatChange_ = function (evt) {
    pskl.UserSettings.set(pskl.UserSettings.COLOR_FORMAT, evt.target.value);
  };

  ns.MiscPreferencesController.prototype.onMaxFpsChange_ = function (evt) {
    var target = evt.target;
    var fps = parseInt(target.value, 10);
    if (fps && !isNaN(fps)) {
      pskl.UserSettings.set(pskl.UserSettings.MAX_FPS, fps);
    } else {
      target.value = pskl.UserSettings.get(pskl.UserSettings.MAX_FPS);
    }
  };

  ns.MiscPreferencesController.prototype.onLayerOpacityChange_ = function (evt) {
    var target = evt.target;
    var opacity = parseFloat(target.value);
    if (!isNaN(opacity)) {
      pskl.UserSettings.set(pskl.UserSettings.LAYER_OPACITY, opacity);
      pskl.UserSettings.set(pskl.UserSettings.LAYER_PREVIEW, opacity !== 0);
      this.updateLayerOpacityText_(opacity);
    } else {
      target.value = pskl.UserSettings.get(pskl.UserSettings.LAYER_OPACITY);
    }
  };

  ns.MiscPreferencesController.prototype.updateLayerOpacityText_ = function (opacity) {
    var layerOpacityText = document.querySelector('.layer-opacity-text');
    layerOpacityText.innerHTML = (opacity * 1).toFixed(2);
  };

  /**
   * Handles NES color replace prompt checkbox toggle.
   * @param {Event} evt - Change event
   * @private
   */
  ns.MiscPreferencesController.prototype.onColorReplacePromptChange_ =
    function (evt) {
      pskl.UserSettings.set(
        pskl.UserSettings.NES_COLOR_REPLACE_PROMPT,
        evt.target.checked);
    };

  /**
   * Handles NES mode checkbox toggle with confirmation warning.
   * @param {Event} evt - Change event
   * @private
   */
  ns.MiscPreferencesController.prototype.onNESModeChange_ = function (evt) {
    var checkbox = evt.target;
    var enabled = checkbox.checked;
    var confirmed = this.confirmNESModeChange_(enabled);

    if (confirmed) {
      pskl.UserSettings.set(pskl.UserSettings.NES_MODE, enabled);
    } else {
      // Revert checkbox to previous state
      checkbox.checked = !enabled;
    }
  };

  /**
   * Shows confirmation dialog for NES mode switch.
   * Skips dialog if canvas is empty (nothing drawn).
   * @param {boolean} enablingNES - True if switching TO NES mode
   * @return {boolean} True if user confirmed or canvas is empty
   * @private
   */
  ns.MiscPreferencesController.prototype.confirmNESModeChange_ = function (
    enablingNES
  ) {
    // Skip warning if nothing is drawn
    if (this.piskelController.isEmpty()) {
      return true;
    }

    var msg;
    if (enablingNES) {
      // Regular -> NES: warn about non-NES colors
      msg = 'Switching to NES Mode.\n\n' +
        'If your sprite uses colors not in the NES palette, they will ' +
        'remain but won\'t be valid for CHR export.\n\n' +
        'Continue?';
    } else {
      // NES -> Regular: mild warning
      msg = 'Switching to Regular Mode.\n\n' +
        'You will have access to the full color spectrum. ' +
        'Your current colors will be preserved.\n\n' +
        'Continue?';
    }
    return window.confirm(msg);
  };
})();
