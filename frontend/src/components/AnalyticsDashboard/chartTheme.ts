import { useTheme } from '../../context/ThemeContext';

export function useChartTheme() {
  const { theme } = useTheme();
  const isDark = theme === 'obsidian';

  return {
    colors: {
      primary: isDark ? '#c99a2e' : '#b8602c',
      secondary: isDark ? '#4d9960' : '#3d7f4d',
      tertiary: isDark ? '#c46b5a' : '#5a7a8a',
      danger: isDark ? '#c45454' : '#a84040',
      grid: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
      text: isDark ? '#8a8478' : '#6b655a',
      textLight: isDark ? '#5e584e' : '#948d82',
      bg: 'transparent',
      tooltip: isDark ? '#16161a' : '#eae5dc',
      tooltipBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    },
    isDark,
  };
}
