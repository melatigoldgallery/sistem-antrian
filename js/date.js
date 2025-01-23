export const dateHandler = {
  formatTanggal(date) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
  },

  initializeDatepicker() {
      const today = new Date();
      
      // Set static date display
      const tglElement = document.getElementById('tgl');
      if (tglElement) {
          tglElement.textContent = this.formatTanggal(today);
      }

      // Initialize datepicker
      const tanggalInput = document.getElementById('tanggal');
      const calendarIcon = document.getElementById('calendarIcon');
      
      if (tanggalInput && calendarIcon) {
          $(tanggalInput).datepicker({
              format: 'dd-mm-yyyy',
              autoclose: true,
              todayHighlight: true,
              language: 'id',
              orientation: 'bottom auto'
          }).datepicker('setDate', today);

          calendarIcon.addEventListener('click', () => {
              $(tanggalInput).datepicker('show');
          });
      }
  }
};
