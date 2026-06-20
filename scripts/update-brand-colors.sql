-- RakushopBD brand colors (logo: forest green + vibrant pink)
UPDATE products SET icon_color = '#2D6B32', bg_color = '#E8F3EA'
WHERE icon_color IN ('#2d8a2d', '#206020', '#164816') OR bg_color IN ('#e8f5e8', '#e8f5e9');

UPDATE products SET icon_color = '#E91E8C', bg_color = '#FDE8EF'
WHERE icon_color IN ('#d48696', '#EF7A9C', '#be4a6a', '#9e5568') OR bg_color IN ('#fdf0f3', '#fce4ec');

UPDATE products SET icon_color = '#2D6B32', bg_color = '#E8F3EA'
WHERE icon_color IS NULL OR bg_color IS NULL;

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#143318,#1E4620,#2D6B32)'
WHERE bg_gradient LIKE '%2d8a2d%' OR bg_gradient LIKE '%164816%';

UPDATE banners SET bg_gradient = 'linear-gradient(135deg,#C21872,#E91E8C,#F062A8)'
WHERE bg_gradient LIKE '%d48696%' OR bg_gradient LIKE '%9e5568%';

UPDATE site_settings SET setting_value = '#FDE8EF'
WHERE setting_key = 'marketing_card1_bg' AND setting_value IN ('#fce4ec', '#fdf0f3');

UPDATE site_settings SET setting_value = '#E8F3EA'
WHERE setting_key = 'marketing_card2_bg' AND setting_value IN ('#ede7f6', '#e8f5e8');
