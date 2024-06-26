import './optimizationsBreakdown.scss';

import {
  Card,
  CardBody,
  CardTitle,
  ClipboardCopyButton,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  Grid,
  GridItem,
  Icon,
  Title,
  TitleSizes,
} from '@patternfly/react-core';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import type { RecommendationTerm } from 'api/ros/recommendations';
import type { Recommendations } from 'api/ros/recommendations';
import type { RecommendationValues } from 'api/ros/recommendations';
import messages from 'locales/messages';
import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { OptimizedState } from 'routes/components/state/optimizedState';
import type { OptimizationType } from 'utils/commonTypes';
import { ConfigType, Interval } from 'utils/commonTypes';
import { formatOptimization, formatPercentage } from 'utils/format';
import { isIntervalOptimized } from 'utils/notifications';
import { hasRecommendationValues } from 'utils/recomendations';
import YAML from 'yaml';

import { styles } from './optimizationsBreakdown.styles';

interface OptimizationsBreakdownConfigurationOwnProps {
  currentInterval?: Interval.short_term | Interval.medium_term | Interval.long_term;
  optimizationType?: OptimizationType;
  recommendations?: Recommendations;
}

type OptimizationsBreakdownConfigurationProps = OptimizationsBreakdownConfigurationOwnProps;

const OptimizationsBreakdownConfiguration: React.FC<OptimizationsBreakdownConfigurationProps> = ({
  currentInterval,
  optimizationType,
  recommendations,
}) => {
  const [copied, setCopied] = useState(false);
  const intl = useIntl();

  const formatValue = (value, units, isFormatted = true, isUnitsOnly = false) => {
    if (!value) {
      return '';
    }
    return isFormatted
      ? intl.formatMessage(messages.optimizationsValue, {
          value: formatOptimization(value),
          units,
        })
      : isUnitsOnly
        ? units
        : value;
  };

  const getConfiguration = (values: RecommendationValues, isFormatted, isUnitsOnly) => {
    const hasConfigLimitsCpu = hasRecommendationValues(values, 'limits', 'cpu');
    const hasConfigLimitsMemory = hasRecommendationValues(values, 'limits', 'memory');
    const hasConfigRequestsCpu = hasRecommendationValues(values, 'requests', 'cpu');
    const hasConfigRequestsMemory = hasRecommendationValues(values, 'requests', 'memory');

    const cpuConfigLimitsAmount = hasConfigLimitsCpu ? values.limits.cpu.amount : undefined;
    const cpuConfigLimitsUnits = hasConfigLimitsCpu ? values.limits.cpu.format : undefined;
    const cpuConfigRequestsAmount = hasConfigRequestsCpu ? values.requests.cpu.amount : undefined;
    const cpuConfigRequestsUnits = hasConfigRequestsCpu ? values.requests.cpu.format : undefined;

    const memConfigLimitsAmount = hasConfigLimitsMemory ? values.limits.memory.amount : undefined;
    const memConfigLimitsUnits = hasConfigLimitsMemory ? values.limits.memory.format : undefined;
    const memConfigRequestsAmount = hasConfigRequestsMemory ? values.requests.memory.amount : undefined;
    const memConfigRequestsUnits = hasConfigRequestsMemory ? values.requests.memory.format : undefined;

    return {
      limits: {
        cpu: formatValue(cpuConfigLimitsAmount, cpuConfigLimitsUnits, isFormatted, isUnitsOnly),
        memory: formatValue(memConfigLimitsAmount, memConfigLimitsUnits, isFormatted, isUnitsOnly),
      },
      requests: {
        cpu: formatValue(cpuConfigRequestsAmount, cpuConfigRequestsUnits, isFormatted, isUnitsOnly),
        memory: formatValue(memConfigRequestsAmount, memConfigRequestsUnits, isFormatted, isUnitsOnly),
      },
    };
  };

  const getCurrentConfig = (isFormatted = true, isUnitsOnly = false) => {
    const values = recommendations?.current;

    return getConfiguration(values, isFormatted, isUnitsOnly);
  };

  const getRecommendationTerm = (): RecommendationTerm => {
    if (!recommendations) {
      return undefined;
    }

    let result;
    switch (currentInterval) {
      case Interval.short_term:
        result = recommendations?.recommendation_terms?.short_term;
        break;
      case Interval.medium_term:
        result = recommendations?.recommendation_terms?.medium_term;
        break;
      case Interval.long_term:
        result = recommendations?.recommendation_terms?.long_term;
        break;
    }
    return result;
  };

  const getRecommendedConfig = (isFormatted = true, isUnitsOnly = false) => {
    const term = getRecommendationTerm();
    const values = term?.recommendation_engines?.[optimizationType]?.config;

    return getConfiguration(values, isFormatted, isUnitsOnly);
  };

  const getCurrentYaml = () => {
    const code = getCurrentConfig(true, false);

    // See https://eemeli.org/yaml/#tojs-options
    return YAML.stringify(code).replace(/"/g, ''); // prettify
  };

  const getCurrentConfigCodeBlock = () => {
    const code = getCurrentYaml();
    if (code === null) {
      return null;
    }
    return (
      <CodeBlock actions={getEmptyActions()}>
        <CodeBlockCode>
          {hasMissingValue(ConfigType.current) ? (
            <span style={styles.codeBlock}>
              <span>{getWarningConfig(ConfigType.current)}</span>
              <span>&nbsp;</span>
              <span>{code}</span>
            </span>
          ) : (
            code
          )}
        </CodeBlockCode>
      </CodeBlock>
    );
  };

  // Returns empty element to force a header
  const getEmptyActions = () => {
    return <div style={styles.currentActions} />;
  };

  const getPercentage = (oldNumber: number, newNumber: number) => {
    if (typeof oldNumber !== 'number' || typeof newNumber !== 'number') {
      return 0;
    }
    const changeValue = newNumber - oldNumber;
    return (changeValue / oldNumber) * 100;
  };

  const getRecommendedActions = () => {
    const code = getRecommendedYaml();

    return (
      <CodeBlockAction>
        <ClipboardCopyButton
          id="copy-button"
          textId="code-content"
          aria-label={intl.formatMessage(messages.copyToClipboard)}
          onClick={e => handleClipboardCopyOnClick(e, code)}
          exitDelay={copied ? 1500 : 600}
          maxWidth="110px"
          variant="plain"
          onTooltipHidden={() => setCopied(false)}
        >
          {intl.formatMessage(copied ? messages.copyToClipboardSuccessfull : messages.copyToClipboard)}
        </ClipboardCopyButton>
      </CodeBlockAction>
    );
  };

  const getRecommendedYaml = () => {
    let code = getRecommendedConfig();
    if (code === null) {
      return null;
    }
    // Add change values
    code = getVariationConfig(code);

    // See https://eemeli.org/yaml/#tojs-options
    return YAML.stringify(code).replace(/"/g, ''); // prettify
  };

  const getRecommendedConfigCodeBlock = () => {
    const code = getRecommendedYaml();
    if (code === null) {
      return null;
    }
    return (
      <CodeBlock actions={getRecommendedActions()}>
        <CodeBlockCode>
          {hasMissingValue(ConfigType.recommended) ? (
            <span style={styles.codeBlock}>
              <span>{getWarningConfig(ConfigType.recommended)}</span>
              <span>&nbsp;</span>
              <span>{code}</span>
            </span>
          ) : (
            code
          )}
        </CodeBlockCode>
      </CodeBlock>
    );
  };

  const getVariationChange = (key1: 'limits' | 'requests', key2: 'cpu' | 'memory') => {
    const currentValues = getCurrentConfig(false);
    const currentUnits = getCurrentConfig(false, true);
    const recommendedValues = getRecommendedConfig(false);
    const recommendedUnits = getRecommendedConfig(false, true);

    let currentVal = currentValues[key1][key2];
    let recommendedVal = recommendedValues[key1][key2];

    // Convert units if not the same
    if (currentUnits[key1][key2] !== recommendedUnits[key1][key2]) {
      if (key2 === 'cpu') {
        // Convert cores to millicores
        //
        // Note: units may be null to omit "cores" label for Kubernetes
        const getMultiplier = (units: string) => {
          return units === null || units === 'cores' ? 1000 : 1;
        };
        currentVal = currentValues[key1][key2] * getMultiplier(currentUnits[key1][key2]);
        recommendedVal = recommendedValues[key1][key2] * getMultiplier(recommendedUnits[key1][key2]);
      } else if (key2 === 'memory') {
        // Convert Gi, Mi, etc. to bytes
        //
        // See https://medium.com/swlh/understanding-kubernetes-resource-cpu-and-memory-units-30284b3cc866
        //
        // Ei = EiB = Exbibyte. 1Ei = 2⁶⁰ = 1,152,921,504,606,846,976 bytes
        // Pi = PiB = Pebibyte. 1Pi = 2⁵⁰ = 1,125,899,906,842,624 bytes
        // Ti = TiB = Tebibyte. 1Ti = 2⁴⁰ = 1,099,511,627,776 bytes
        // Gi = GiB = Gibibyte. 1Gi = 2³⁰ = 1,073,741,824 bytes
        // Mi = MiB = Mebibyte. 1Mi = 2²⁰ = 1,048,576 bytes
        // Ki = KiB = Kibibyte. 1Ki = 2¹⁰ = 1,024 bytes
        const getMultiplier = (units: string) => {
          switch (units.toLowerCase()) {
            case 'ei':
              return Math.pow(2, 60);
            case 'pi':
              return Math.pow(2, 50);
            case 'ti':
              return Math.pow(2, 40);
            case 'gi':
              return Math.pow(2, 30);
            case 'mi':
              return Math.pow(2, 20);
            case 'ki':
              return Math.pow(2, 10);
            default:
              return 1;
          }
        };
        currentVal = currentValues[key1][key2] * getMultiplier(currentUnits[key1][key2]);
        recommendedVal = recommendedValues[key1][key2] * getMultiplier(recommendedUnits[key1][key2]);
      }
    }

    // Calculate percentage change
    const percentage = getPercentage(currentVal, recommendedVal);
    return intl.formatMessage(messages.percentPlus, {
      count: percentage > 0 ? 1 : 0,
      value: formatPercentage(percentage),
    });
  };

  const getVariationConfig = config => {
    // Get longest formatted string containing units
    const limitsCpuChars = `cpu: ${config.limits.cpu}`.length;
    const limitsMemoryChars = `memory: ${config.limits.memory}`.length;
    const requestsCpuChars = `cpu: ${config.requests.cpu}`.length;
    const requestsMemoryChars = `memory: ${config.requests.memory}`.length;

    // Calculate max characters in order to left-align change values
    const maxChars = Math.max(limitsCpuChars, limitsMemoryChars, requestsCpuChars, requestsMemoryChars);

    const cpuVariationLimitsChange = getVariationSpacing(
      maxChars - limitsCpuChars,
      getVariationChange('limits', 'cpu')
    );
    const memoryVariationLimitsChange = getVariationSpacing(
      maxChars - limitsMemoryChars,
      getVariationChange('limits', 'memory')
    );
    const cpuVariationRequestsChange = getVariationSpacing(
      maxChars - requestsCpuChars,
      getVariationChange('requests', 'cpu')
    );
    const memoryVariationRequestsChange = getVariationSpacing(
      maxChars - requestsMemoryChars,
      getVariationChange('requests', 'memory')
    );

    const concatValue = (value, change) => {
      if (!value) {
        return '';
      }
      return `${value}${change}`;
    };

    return {
      limits: {
        cpu: concatValue(config.limits.cpu, cpuVariationLimitsChange),
        memory: concatValue(config.limits.memory, memoryVariationLimitsChange),
      },
      requests: {
        cpu: concatValue(config.requests.cpu, cpuVariationRequestsChange),
        memory: concatValue(config.requests.memory, memoryVariationRequestsChange),
      },
    };
  };

  const getVariationSpacing = (count: number, value) => {
    if (!value) {
      return '';
    }
    let spacing = '  # ';
    for (let i = 0; i < count; i++) {
      spacing = ` ${spacing}`;
    }
    return `${spacing}${value}`;
  };

  const getWarningConfig = (key: ConfigType.current | ConfigType.recommended) => {
    const values = key === ConfigType.current ? getCurrentConfig(false) : getRecommendedConfig(false);

    const getWarning = value => {
      return !value ? (
        <Icon status="warning">
          <ExclamationTriangleIcon />
        </Icon>
      ) : null;
    };

    return (
      <>
        <br />
        {getWarning(values.limits.cpu)}
        <br />
        {getWarning(values.limits.memory)}
        <br />
        <br />
        {getWarning(values.requests.cpu)}
        <br />
        {getWarning(values.requests.memory)}
      </>
    );
  };

  const handleClipboardCopyOnClick = (event, text) => {
    navigator.clipboard.writeText(text.toString());
    setCopied(true);
  };

  const hasMissingValue = (key: ConfigType.current | ConfigType.recommended) => {
    const values = key === ConfigType.current ? getCurrentConfig(false) : getRecommendedConfig(false);

    const isMissingValue = value => {
      return !value || `${value}`.trim().length === 0;
    };

    const cpuLimitsWarning = isMissingValue(values.limits.cpu);
    const cpuRequestsWarning = isMissingValue(values.requests.cpu);
    const memoryLimitsWarning = isMissingValue(values.limits.memory);
    const memoryRequestsWarning = isMissingValue(values.requests.memory);

    return cpuLimitsWarning || cpuRequestsWarning || memoryLimitsWarning || memoryRequestsWarning;
  };

  const isOptimized = isIntervalOptimized(recommendations, currentInterval, optimizationType);

  return (
    <Grid hasGutter>
      <GridItem xl={6}>
        <Card>
          <CardTitle>
            <Title headingLevel="h2" size={TitleSizes.lg}>
              {intl.formatMessage(messages.currentConfiguration)}
            </Title>
          </CardTitle>
          <CardBody>{getCurrentConfigCodeBlock()}</CardBody>
        </Card>
      </GridItem>
      <GridItem xl={6}>
        <Card>
          {isOptimized ? (
            <CardBody style={styles.optimizedState}>
              <OptimizedState />
            </CardBody>
          ) : (
            <>
              <CardTitle>
                <Title headingLevel="h2" size={TitleSizes.lg}>
                  {intl.formatMessage(messages.recommendedConfiguration)}
                </Title>
              </CardTitle>
              <CardBody>{getRecommendedConfigCodeBlock()}</CardBody>
            </>
          )}
        </Card>
      </GridItem>
    </Grid>
  );
};

export { OptimizationsBreakdownConfiguration };
