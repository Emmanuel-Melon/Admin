import Component from '@glimmer/component';
import {action} from '@ember/object';
import {inject as service} from '@ember/service';

export default class ChartMonthlyRevenue extends Component {
    @service dashboardStats;

    constructor() {
        super(...arguments);
        this.loadCharts();
    }

    /**
     * Call this method when you need to fetch new data from the server. In this component, it will get called
     * when the days parameter changes and on initialisation.
     */
    @action
    loadCharts() {
        // The dashboard stats service will take care or reusing and limiting API-requests between charts
        this.dashboardStats.loadMrrStats(this.args.days);
    }

    get chartType() {
        return 'line';
    }

    get chartData() {
        const stats = this.dashboardStats.mrrStats;
        const labels = stats.map(stat => stat.date);
        const data = stats.map(stat => stat.mrr);

        return {
            labels: labels,
            datasets: [{
                data: data,
                fill: false,
                borderColor: '#14b8ff',
                tension: 0.1
            }]
        };
    }

    get chartOptions() {
        return {
            legend: {
                display: false
            }
        };
    }

    get chartHeight() {
        return 150;
    }
}