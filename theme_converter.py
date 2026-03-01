import os
import re

def convert_theme(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # If already using white theme colors (like #F8FAFC), skip
    if '#F8FAFC' in content and 'glass' in content:
        # maybe skip?
        pass

    # Map Dark Theme to Light Theme
    replacements = {
        r'#0a0f1e': '#F8FAFC',  # App background
        r'#0f172a': '#FFFFFF',  # Card background
        r'#1e293b': '#F1F5F9',  # Lighter element background
        r'#334155': '#E2E8F0',  # Borders
        r'#e2e8f0': '#0F172A',  # Main text
        r'#f1f5f9': '#0F172A',  # Main text 2
        r'#94a3b8': '#475569',  # Secondary text
        r'#4f46e5': '#10B981',  # Primary Brand (purple -> green)
        r'#1e40af': '#10B981',  # Dark blue -> green
        r'#475569': '#64748B',  # slightly lighter text
        r'#1e1b4b': '#F1F5F9',  # Gradient end
        r'linear-gradient\(135deg, #0f172a 0%, #1e1b4b 100%\)': 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        r'rgba\(255, 255, 255, 0.1\)': 'rgba(0, 0, 0, 0.1)',
        r'rgba\(30, 41, 59, 0.85\)': '#FFFFFF',
        r'rgba\(15, 23, 42, 0.6\)': '#FFFFFF',
        r'#f8fafc': '#0F172A',
        r'#0F172A, 0.7': '#F8FAFC, 0.7', # adjust backdrop
        r'#1e293b44': '#F1F5F9',
        r'#93c5fd': '#2563EB', # Blue text adjustment for contrast on light bg
        r'#fca5a5': '#DC2626', # Red text on light bg
        r'#6ee7b7': '#059669', # Green text on light bg
        r'color: "#FFF"': 'color: "#0F172A"',
        r'color: "#fff"': 'color: "#0F172A"',
        r'color: "white"': 'color: "#0F172A"',
        r'color:"#fff"': 'color:"#0F172A"',
        r'#f0abfc': '#C026D3',
        r'color: tab === name \? "#fff" : "#64748b"': 'color: tab === name ? "#FFFFFF" : "#64748b"'
    }

    # Special careful replacements
    new_content = content
    for old, new in replacements.items():
        new_content = re.sub(old, new, new_content, flags=re.IGNORECASE)

    # Manual fixes for specific components
    new_content = new_content.replace('color: tab === name ? "#0F172A" : "#64748b"', 'color: tab === name ? "#FFFFFF" : "#64748b"')
    new_content = new_content.replace('color: sp.color', 'color: sp.color') # Just checking
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('/Users/aryanpatel/Desktop/MediLoop/frontend/src/modules'):
    for file in files:
        if file.endswith('.jsx'):
            convert_theme(os.path.join(root, file))

