function DismissibleMessage({ children, className, onClose, role }) {
  return (
    <div className={`message dismissible ${className}`} role={role}>
      <span>{children}</span>
      <button aria-label="Закрити повідомлення" onClick={onClose} type="button">
        ×
      </button>
    </div>
  )
}

export default DismissibleMessage
