/**
 * Money Machine - Basic Usage Example
 *
 * This example demonstrates how to set up and use the money-machine system.
 */

import { createMoneyMachine } from '../src/index.js';
import { DemoResearchStrategy } from '../src/strategies/demo-research.js';

async function main() {
  console.log('Money Machine - Demo Example\n');

  // 1. Create and initialize the money machine
  console.log('1. Initializing Money Machine...');
  const machine = await createMoneyMachine({
    logLevel: 'info',
    strictCompliance: true,
  });
  console.log('   ✓ Money Machine initialized\n');

  // 2. Add accounts (if needed for strategies)
  // For demo strategy, no accounts required
  console.log('2. Accounts:');
  console.log('   - Demo strategy requires no accounts');
  console.log('   - In production, add accounts with:');
  console.log("     machine.addAccount('platform', { credentials... })\n");

  // 3. Load a strategy
  console.log('3. Loading demo research strategy...');
  const demoStrategy = new DemoResearchStrategy();
  await machine.loadStrategy(demoStrategy);
  console.log('   ✓ Strategy loaded\n');

  // 4. Get current status
  console.log('4. System Status:');
  const status = await machine.getStatus();
  console.log('   - Initialized:', status.initialized);
  console.log('   - Running:', status.running);
  console.log('   - Accounts:', status.accounts.length);
  console.log('   - Strategies:', Object.keys(status.strategies).length, '\n');

  // 5. Get earnings report (will be $0 for demo)
  console.log('5. Earnings Report:');
  const report = await machine.getEarningsReport();
  console.log(`   - Total Earnings: $${report.totalEarnings.toFixed(2)}`);
  console.log(
    '   - Strategies:',
    Object.keys(report.byStrategy).join(', '),
    '\n'
  );

  // 6. Show compliance status
  console.log('6. Compliance Status:');
  console.log('   - Total Violations:', status.compliance.totalViolations);
  console.log('   - Strict Mode: enabled');
  console.log('   - All actions are pre-validated\n');

  console.log('Demo completed successfully!');
  console.log('\nNext Steps:');
  console.log('- Review docs/research/ for implementation strategies');
  console.log('- Add real strategy modules in src/strategies/');
  console.log('- Configure accounts for platforms');
  console.log('- Start the machine with machine.start()');
  console.log(
    '- Monitor with machine.getStatus() and machine.getEarningsReport()'
  );
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
