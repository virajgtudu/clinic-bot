from services.whatsapp import clean_phone_number

test_cases = [
    919876543210.0,
    '919876543210.0',
    9876543210,
    '9876543210',
    '+91 98765 43210',
    '919876543210',
    float('nan')
]

for t in test_cases:
    print(f"Original: {t!r} -> Cleaned: {clean_phone_number(t)!r}")
