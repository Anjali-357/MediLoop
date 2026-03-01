const fs = require('fs');
const path = require('path');

const filesToFix = [
    '/Users/aryanpatel/Desktop/MediLoop/frontend/src/modules/control/index.jsx',
    '/Users/aryanpatel/Desktop/MediLoop/frontend/src/modules/caregap/index.jsx'
];

const replacements = [
    { find: /background: '#020617'/g, replace: "background: '#F8FAFC'" },
    { find: /border: '1px solid #0F172A'/g, replace: "border: '1px solid #E2E8F0'" },
    { find: /border: \`1px solid \$\{colors\.border\}\`/g, replace: "border: `1px solid ${colors.border}`" },
    { find: /border: \`1px solid \$\{selected\.has\(g\._id\) \? '#10B981' : '#0F172A'\}\`/g, replace: "border: `1px solid ${selected.has(g._id) ? '#10B981' : '#E2E8F0'}`" },
    { find: /background: '#0F172A', border: '1px solid #E2E8F0'/g, replace: "background: '#FFFFFF', border: '1px solid #E2E8F0'" },
    { find: /background: '#0F172A', border: '1px solid #0F172A'/g, replace: "background: '#FFFFFF', border: '1px solid #E2E8F0'" },
    { find: /background: selected\.has\(g\._id\) \? '#0F172A' : '#020617'/g, replace: "background: selected.has(g._id) ? '#F1F5F9' : '#F8FAFC'" },
    { find: /background: selected\.size \? '#10B981' : '#0F172A'/g, replace: "background: selected.size ? '#10B981' : '#94A3B8'" },
    { find: /border: '2px dashed #0F172A'/g, replace: "border: '2px dashed #CBD5E1'" },
    { find: /background: '#0F172A'/g, replace: "background: '#FFFFFF'" } // Catch-all for remaining dark backgrounds inside cards
];

for (const file of filesToFix) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        let newContent = content;
        for (const rule of replacements) {
            newContent = newContent.replace(rule.find, rule.replace);
        }
        if (content !== newContent) {
            fs.writeFileSync(file, newContent);
            console.log(`Updated ${file}`);
        }
    }
}
