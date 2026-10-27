// The one button used across the app.
//   variant: primary | secondary | quiet | danger | danger-solid
//   size:    md (default) | sm  (sm is for use inside table rows and toolbars)
const VARIANT_CLASS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  quiet: 'btn-quiet',
  danger: 'btn-danger-outline',
  'danger-solid': 'btn-danger-solid',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  ...rest // onClick, title, aria-*, style ... are all passed through
}) => {
  const classes = ['btn', VARIANT_CLASS[variant] || `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} type={type} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
};

export default Button;
