import urllib.request, re, sys
url = 'http://127.0.0.1:5000/people?name1=Emma+Stone'
try:
    with urllib.request.urlopen(url, timeout=10) as r:
        html = r.read().decode('utf-8', 'replace')
except Exception as e:
    print('ERROR:', e)
    sys.exit(1)
print('--- HTML preview (first 1200 chars) ---')
print(html[:1200])
print('\n--- End preview ---\n')
imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html, flags=re.I)
print('Found', len(imgs), 'img tags. Unique image URLs:')
for src in sorted(set(imgs)):
    print('-', src)
# Count radio inputs
radios = re.findall(r'<input[^>]+type=["\']radio["\']', html, flags=re.I)
print('\nRadio inputs found:', len(radios))
# Confirm presence of confirmation button text
print('\nContains confirm button text?:', 'Confirm and search films' in html)
