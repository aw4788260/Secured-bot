// أضف هذه الدالة داخل الصفحة
  const checkStatus = async () => {
      // نرسل البصمة للسيرفر لنتأكد هل هو مسجل في جدول wheel_spins أم لا
      const res = await fetch(`/api/public/check-spin-status?fingerprint=${fingerprint}`);
      const data = await res.json();
      
      if (!data.hasPlayed) {
          localStorage.removeItem('wheel_has_played');
          setHasPlayedLocal(false);
      } else {
          localStorage.setItem('wheel_has_played', 'true');
          setHasPlayedLocal(true);
      }
  };
