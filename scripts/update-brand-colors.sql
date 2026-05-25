-- RakushopBD brand colors (logo: green #206020 + pink #d48696)
UPDATE products SET icon_color = '#2d8a2d', bg_color = '#e8f5e8'
WHERE icon_color IN ('#185FA5', '#0C447C') OR bg_color IN ('#E6F1FB', '#dbeafe');

UPDATE products SET icon_color = '#d48696', bg_color = '#fdf0f3'
WHERE icon_color IN ('#993556', '#E24B4A', '#A32D2D');

UPDATE products SET icon_color = '#2d8a2d', bg_color = '#e8f5e8'
WHERE icon_color = '#3B6D11' OR bg_color = '#EAF3DE';

UPDATE products SET icon_color = '#8a6914', bg_color = '#faf3e0'
WHERE icon_color = '#854F0B' OR bg_color IN ('#FAEEDA', '#fef3c7');

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#2d8a2d,#164816)'
WHERE bg_gradient LIKE '%185FA5%' OR bg_gradient LIKE '%0C447C%';

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#d48696,#9e5568)'
WHERE bg_gradient LIKE '%E24B4A%' OR bg_gradient LIKE '%A32D2D%';
