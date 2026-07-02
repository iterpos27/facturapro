import Swal from 'sweetalert2'

export function showToast(message, type = 'success') {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon: type,
    title: message,
    showConfirmButton: false,
    showCloseButton: true,
    timer: 3200,
    timerProgressBar: true,
    background: '#ffffff',
    color: '#1f2937',
    iconColor: type === 'success' ? '#16a34a' : type === 'warning' ? '#d97706' : '#dc2626',
    customClass: {
      popup: 'swal-toast-shell',
      title: 'swal-toast-title',
      timerProgressBar: 'swal-toast-progress',
      closeButton: 'swal-toast-close',
    },
  })
}
