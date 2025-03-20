export const dateHandler = {
    formatTanggal(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    },
  
    initializeDatepicker() {
      const today = new Date();
      
      // Format date in Indonesian
      const formatTanggal = (date) => {
          const months = [
              'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
              'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          
          const day = date.getDate();
          const month = months[date.getMonth()];
          const year = date.getFullYear();
          
          return `${day} ${month} ${year}`;
      };
      
      // Update clock every second
      const updateClock = () => {
          const now = new Date();
          const time = now.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
          });
          
          // Perbaikan: Periksa elemen clock atau current-time sebelum mengatur textContent
          const clockElement = document.getElementById('clock') || document.getElementById('current-time');
          if (clockElement) {
              clockElement.textContent = time;
          }
      };
      
      // Set initial date
      const tglElement = document.getElementById('tgl') || document.getElementById('current-date');
      if (tglElement) {
          tglElement.textContent = formatTanggal(today);
      }
      
      // Start clock
      updateClock();
      setInterval(updateClock, 1000);
  
  
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
  