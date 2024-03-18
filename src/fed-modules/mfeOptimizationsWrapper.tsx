/* eslint-disable no-console */
import IntlProvider from '@redhat-cloud-services/frontend-components-translations/Provider';
import { getLocale } from 'components/i18n';
import React from 'react';
import { Provider } from 'react-redux';
import { mfeStore } from 'store';

// eslint-disable-next-line no-restricted-imports
import messages from '../../locales/data.json';

export interface OptimizationsWrapperOwnProps {
  children?: React.ReactNode;
}

type OptimizationsWrapperProps = OptimizationsWrapperOwnProps;

const MfeOptimizationsWrapper: React.FC<OptimizationsWrapperProps> = ({ children }: OptimizationsWrapperOwnProps) => {
  const locale = getLocale();

  // Note: className is a workaround for ConsoleDot outputting the app name instead of module name
  return (
    <IntlProvider defaultLocale="en" locale={locale} messages={messages[locale]} onError={console.log}>
      <Provider store={mfeStore as any}>
        <div className="costManagementMfe">{children}</div>
      </Provider>
    </IntlProvider>
  );
};

export { MfeOptimizationsWrapper };
