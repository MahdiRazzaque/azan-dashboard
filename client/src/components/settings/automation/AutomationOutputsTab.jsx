import { Zap } from 'lucide-react';
import OutputStrategyCard from '@/components/settings/OutputStrategyCard';

/**
 * AutomationOutputsTab component handles the list of output integrations.
 * 
 * @param {object} props - The component props.
 * @param {Array} props.strategies - List of output strategies from registry.
 * @param {object} props.formData - The current draft configuration object.
 * @param {object} props.systemHealth - The system health status object.
 * @param {Function} props.updateSetting - Callback to update settings.
 * @returns {JSX.Element} The rendered output integrations tab.
 */
export default function AutomationOutputsTab({ strategies, formData, systemHealth, updateSetting }) {
    return (
        <section className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2 border-b border-app-border pb-2">
                <Zap className="w-5 h-5" />
                Output Strategies
            </h2>
            <p className="text-sm text-app-dim mb-6">
                Configure audio output targets. Enable strategies to route audio to different devices or services.
            </p>
            <div className="grid grid-cols-1 gap-6">
                {strategies.map(strategy => (
                    <OutputStrategyCard 
                        key={strategy.id} 
                        strategy={strategy}
                        config={formData?.automation?.outputs?.[strategy.id]}
                        systemHealth={systemHealth}
                        onChange={(field, val) => updateSetting(`automation.outputs.${strategy.id}.${field}`, val)}
                    />
                ))}
            </div>
        </section>
    );
}
