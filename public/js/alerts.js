/**
 * Global Alert & Notification Service (Scaffolded with SweetAlert2)
 * CP Food Division LPP Dashboard
 * 
 * Provides unified, non-hardcoded modal alerts, confirmations, loading spinners,
 * and validation error lists matching the corporate design system.
 */

(function () {
  'use strict';

  // Base custom SweetAlert configuration matching app aesthetics
  const getCustomSwal = () => {
    if (typeof Swal === 'undefined') {
      console.warn('SweetAlert2 library is not loaded.');
      return {
        fire: (opts) => alert(opts.title + '\n' + (opts.text || ''))
      };
    }

    return Swal.mixin({
      customClass: {
        popup: 'cp-swal-popup',
        title: 'cp-swal-title',
        htmlContainer: 'cp-swal-content',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-outline-secondary',
        actions: 'cp-swal-actions'
      },
      buttonsStyling: false,
      focusConfirm: true,
      reverseButtons: true
    });
  };

  const AppAlert = {
    /**
     * Show success modal alert
     * @param {string} title
     * @param {string} message
     * @param {number} timer Auto-close timer in ms (0 = no auto-close)
     */
    success: function (title, message = '', timer = 2200) {
      const swalInstance = getCustomSwal();
      return swalInstance.fire({
        icon: 'success',
        title: title || 'Berhasil',
        text: message,
        timer: timer > 0 ? timer : undefined,
        showConfirmButton: timer <= 0,
        confirmButtonText: 'Selesai'
      });
    },

    /**
     * Show warning modal alert, optionally focusing on an input element
     * @param {string} title
     * @param {string} message
     * @param {string|null} focusElementId DOM Element ID to focus after dismissal
     */
    warning: function (title, message = '', focusElementId = null) {
      const swalInstance = getCustomSwal();
      return swalInstance.fire({
        icon: 'warning',
        title: title || 'Peringatan',
        text: message,
        confirmButtonText: 'Mengerti'
      }).then((result) => {
        if (focusElementId) {
          const el = document.getElementById(focusElementId);
          if (el) {
            setTimeout(() => {
              el.focus();
              if (typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }
        }
        return result;
      });
    },

    /**
     * Show generic error modal
     * @param {string} title
     * @param {string} message
     */
    error: function (title, message = '') {
      const swalInstance = getCustomSwal();
      return swalInstance.fire({
        icon: 'error',
        title: title || 'Terjadi Kesalahan',
        text: message,
        confirmButtonText: 'Tutup'
      });
    },

    /**
     * Show structured validation errors (e.g. from Excel parser / validator)
     * @param {string} title
     * @param {string[]|string} errors List of error strings or single message
     * @param {string[]} warnings Optional list of warning strings
     */
    validationErrors: function (title, errors = [], warnings = []) {
      const swalInstance = getCustomSwal();
      const errorList = Array.isArray(errors) ? errors : [errors].filter(Boolean);
      const warningList = Array.isArray(warnings) ? warnings : [warnings].filter(Boolean);

      let htmlContent = '<div style="text-align: left; max-height: 280px; overflow-y: auto; padding: 0.25rem 0.5rem;">';

      if (errorList.length > 0) {
        htmlContent += '<div style="font-weight: 700; color: #dc2626; margin-bottom: 0.35rem; font-size: 0.9rem;">Ditemukan ' + errorList.length + ' Kolom Wajib / Kesalahan:</div>';
        htmlContent += '<ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: #1e293b; line-height: 1.5;">';
        errorList.forEach((err) => {
          htmlContent += '<li style="margin-bottom: 0.25rem;">' + err + '</li>';
        });
        htmlContent += '</ul>';
      }

      if (warningList.length > 0) {
        htmlContent += '<div style="font-weight: 700; color: #d97706; margin-top: 0.75rem; margin-bottom: 0.35rem; font-size: 0.9rem;">Peringatan (' + warningList.length + '):</div>';
        htmlContent += '<ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: #475569; line-height: 1.5;">';
        warningList.forEach((warn) => {
          htmlContent += '<li style="margin-bottom: 0.25rem;">' + warn + '</li>';
        });
        htmlContent += '</ul>';
      }

      htmlContent += '</div>';

      return swalInstance.fire({
        icon: 'error',
        title: title || 'Validasi Berkas Gagal',
        html: htmlContent,
        confirmButtonText: 'Cek Kembali format excel anda'
      });
    },

    /**
     * Show loading spinner dialog (blocking)
     * @param {string} title
     * @param {string} message
     */
    loading: function (title = 'Memproses Berkas...', message = 'Harap tunggu, sedang mengekstrak dan memvalidasi sel Excel...') {
      if (typeof Swal === 'undefined') return;
      Swal.fire({
        title: title,
        html: '<div style="font-size: 0.9rem; color: #475569; margin-top: 0.5rem;">' + message + '</div>',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
    },

    /**
     * Close any currently open alert/loading modal
     */
    close: function () {
      if (typeof Swal !== 'undefined') {
        Swal.close();
      }
    },

    /**
     * Show confirmation dialog
     * @param {Object} options
     * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise
     */
    confirm: function ({
      title = 'Konfirmasi Aksi',
      message = 'Apakah Anda yakin ingin melanjutkan?',
      icon = 'question',
      confirmText = 'Ya, Lanjutkan',
      cancelText = 'Batal',
      confirmBtnClass = 'btn btn-primary'
    } = {}) {
      if (typeof Swal === 'undefined') {
        return Promise.resolve(window.confirm(title + '\n' + message));
      }

      return Swal.fire({
        title,
        text: message,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        customClass: {
          popup: 'cp-swal-popup',
          title: 'cp-swal-title',
          htmlContainer: 'cp-swal-content',
          confirmButton: confirmBtnClass,
          cancelButton: 'btn btn-outline-secondary',
          actions: 'cp-swal-actions'
        },
        buttonsStyling: false,
        reverseButtons: true
      }).then((result) => result.isConfirmed);
    },

    /**
     * Lightweight Toast Notification in top-right corner
     * @param {string} message
     * @param {string} type 'success' | 'error' | 'warning' | 'info'
     */
    toast: function (message, type = 'success') {
      if (typeof Swal === 'undefined') {
        console.log(type.toUpperCase() + ': ' + message);
        return;
      }

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });

      return Toast.fire({
        icon: type,
        title: message
      });
    }
  };

  // Expose globally to window object
  window.AppAlert = AppAlert;
})();
