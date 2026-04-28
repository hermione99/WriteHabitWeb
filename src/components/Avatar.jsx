import { resolveAssetUrl } from '../lib/api.js';

export const Avatar = ({ url, initial = '?', size = 36, fontSize, style = {}, className = '', alt = '', onClick, ...rest }) => {
  const resolved = resolveAssetUrl(url);
  const baseStyle = {
    width: size,
    height: size,
    fontSize: fontSize ?? Math.max(10, Math.round(size * 0.42)),
    ...style,
  };
  const cls = `avatar${className ? ` ${className}` : ''}`;
  if (resolved) {
    return (
      <img
        src={resolved}
        alt={alt}
        className={cls}
        style={{ objectFit: 'cover', ...baseStyle }}
        onClick={onClick}
        {...rest}
      />
    );
  }
  return (
    <div className={cls} style={baseStyle} onClick={onClick} {...rest}>
      {initial}
    </div>
  );
};
