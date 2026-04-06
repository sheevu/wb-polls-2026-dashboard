import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface Props {
  id: string;
  labels: string[];
  values: number[];
  colors: string[];
}

const DoughnutChart = ({ id, labels, values, colors }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const chart = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        cutout: '70%',
        plugins: { legend: { position: 'bottom' } },
      },
    });
    return () => chart.destroy();
  }, [labels, values, colors]);

  return <canvas id={id} ref={canvasRef} />;
};

export default DoughnutChart;
