const InputField = ({
  label,
  id,
  type = 'text',
  value,
  onChange,
  required = false,
  className = '',
  help,
  ...rest // step, min, autoComplete, placeholder ... are passed to the <input>
}) => (
  <div className="field">
    <label htmlFor={id} className="form-label">
      {label}
      {required && <span className="required-mark" aria-hidden="true"> *</span>}
    </label>
    <input
      type={type}
      className={`form-control ${className}`}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      {...rest}
    />
    {help && <div className="field-help">{help}</div>}
  </div>
);

export default InputField;
