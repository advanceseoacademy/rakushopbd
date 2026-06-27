-- Sync product/banner accent colors with updated RakushopBD logo palette
UPDATE products SET icon_color = '#39B000', bg_color = '#ECF9E8'
WHERE icon_color IN ('#2D6B32', '#1E4620') OR bg_color IN ('#E8F3EA');

UPDATE products SET icon_color = '#F50087', bg_color = '#FFE8F3'
WHERE icon_color IN ('#E91E8C', '#C21872') OR bg_color IN ('#FDE8EF');

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#248600,#39B000,#52D020)'
WHERE bg_gradient LIKE '%#1E4620%' OR bg_gradient LIKE '%#2D6B32%';

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#C8006A,#F50087,#FF4DAA)'
WHERE bg_gradient LIKE '%#E91E8C%' OR bg_gradient LIKE '%#C21872%';
