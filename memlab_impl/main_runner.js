const { run } = require('@memlab/api');
const scenario = require('./scenarios/details_scenario.js');
const customLeakFilter = require('./filters/react_leak_filter.js');

async function main() {
    scenario.leakFilter = customLeakFilter.leakFilter;
    const result = await run({
        scenario: scenario,
    });

    if (result.leaks.length > 0) {
        result.leaks.forEach(leakNode => {
            // 3. THE FIX: Look up the component name in our external Map using the node's ID.
            const componentName = customLeakFilter.componentLeakMap.get(leakNode.id) || 'Unknown';
       
            console.log(`Component Leaking: <${componentName}>`);
            
        });

        // process.exit(1);
    }
    else {
        console.log('No leaks detected!');
    }
}

main();