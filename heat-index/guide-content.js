// Keep the in-app and printable guides in sync by documenting features here.
window.HEAT_INDEX_GUIDE = [
    {
        title: 'Dashboard at a glance',
        description: 'The dashboard monitors apparent heat conditions for Noveleta, Cavite, using coordinates 14.4281° N, 120.8809° E.',
        steps: [
            'The top advisory shows the current heat-risk category, health guidance, last update time, and heat index in Celsius and Fahrenheit.',
            'The metric cards show air temperature, relative humidity, wind speed, and a short weather description.',
            'The gauge shows the current risk band. The forecast chart compares hourly heat index and air temperature for the next 24 hours.'
        ],
        note: 'Weather is requested from Open-Meteo. If that service is unavailable, the app can display simulated fallback values; verify the data source and connection before treating those values as live observations.',
        controls: []
    },
    {
        title: 'Refresh weather data',
        description: 'Weather data refreshes automatically every 10 minutes, or you can request an update.',
        steps: [
            'Select Refresh Data in the upper-right corner.',
            'Check Last Updated to see when the latest response was received.'
        ],
        note: 'A refresh needs an internet connection and the weather service to be available.',
        controls: ['refresh-btn']
    },
    {
        title: 'Understand heat-risk levels',
        description: 'The dashboard uses these heat-index bands: Safe below 27°C; Caution 27–32°C; Extreme Caution 33–41°C; Danger 42–51°C; and Extreme Danger at 52°C or above.',
        steps: [
            'Read the colored risk badge and advisory at the top of the dashboard.',
            'Use the gauge and threshold legend to see where the current reading falls.',
            'Follow the general, worker, school, and vulnerable-person guidance for the current conditions.'
        ],
        note: 'The dashboard provides situational information and does not replace official PAGASA, medical, or emergency-service advice.',
        controls: []
    },
    {
        title: 'Explore the barangay estimates',
        description: 'The barangay grid shows estimated heat-index categories for Noveleta’s 16 barangays.',
        steps: [
            'Type part of a barangay name in Search barangay to filter the cards.',
            'Compare the displayed estimate and risk category with the overall dashboard reading.'
        ],
        note: 'Coastal barangays are shown with a simple +1°C estimate adjustment; these are not separate local sensor readings.',
        controls: ['barangay-search']
    },
    {
        title: 'View sector safety guidance',
        description: 'Guidance is grouped for the general public, outdoor workers, schools and youth, and seniors and other vulnerable people.',
        steps: [
            'Select a sector tab in the DRRM Noveleta Safety Guidelines panel.',
            'Read the three recommendations shown for that group.'
        ],
        controls: ['sector-public', 'sector-workers', 'sector-schools', 'sector-seniors']
    },
    {
        title: 'Change the appearance',
        description: 'Switch between the dashboard’s dark and light themes at any time.',
        steps: [
            'Select the moon or sun button in the upper-right corner to toggle the theme.'
        ],
        controls: ['theme-toggle']
    },
    {
        title: 'Call an emergency contact',
        description: 'The contact cards open the device’s phone app when the device supports telephone links.',
        steps: [
            'Select the contact card for MDRRMO Rescue, BFP, PNP, or the Municipal Health Office.',
            'Confirm the number in your phone app before placing the call.'
        ],
        note: 'The Municipal Health Office number is a landline and cannot receive SMS. Confirm contact details with local authorities if they may have changed.',
        controls: ['hotline-mdrrmo', 'hotline-bfp', 'hotline-pnp', 'hotline-health-office']
    },
    {
        title: 'Report an emergency and prepare a group SMS',
        description: 'The form prepares an SMS draft addressed to the MDRRMO, BFP, and PNP mobile numbers. The app does not send the message automatically.',
        steps: [
            'Select Report Emergency, enter your name, choose the barangay and emergency type, and enter a contact number.',
            'Choose Use my GPS and allow location access, or tap the map to place a pin. Drag the pin to adjust it. A location pin is required.',
            'Select Prepare SMS for All Mobile Hotlines. Review the recipient list and message in your messaging app, then tap Send yourself.',
            'For the Municipal Health Office, use its Call link separately; it is a landline and is not included in the SMS recipients.'
        ],
        note: 'GPS works on the HTTPS Pages site when the browser grants location permission. The location is used to build the SMS draft; it is not sent to this website. The draft includes coordinates and an OpenStreetMap link.',
        controls: [
            'report-emergency-btn',
            'close-emergency-btn',
            'emergency-name',
            'emergency-barangay',
            'get-emergency-location-btn',
            'emergency-map',
            'emergency-type',
            'emergency-contact',
            'prepare-emergency-sms-btn',
            'hotline-health-office-success'
        ]
    },
    {
        title: 'Open or print this guide',
        description: 'The same feature guide is available inside the dashboard and as a clean, printable page.',
        steps: [
            'Select the question-mark button in the dashboard header to open this guide.',
            'Select Open printable guide to open the print-friendly version in a new tab.',
            'Use Print on that page or your browser’s print command. In the print dialog, choose a printer or Save as PDF.'
        ],
        controls: ['help-guide-btn', 'close-guide-btn']
    }
];

window.renderHeatIndexGuide = function renderHeatIndexGuide(container) {
    if (!container) throw new Error('A guide content container is required.');

    for (const section of window.HEAT_INDEX_GUIDE) {
        const article = document.createElement('article');
        article.className = 'guide-section';

        const heading = document.createElement('h2');
        heading.textContent = section.title;
        article.appendChild(heading);

        const description = document.createElement('p');
        description.textContent = section.description;
        article.appendChild(description);

        const steps = document.createElement('ol');
        for (const text of section.steps) {
            const item = document.createElement('li');
            item.textContent = text;
            steps.appendChild(item);
        }
        article.appendChild(steps);

        if (section.note) {
            const note = document.createElement('p');
            note.className = 'guide-note';
            note.textContent = section.note;
            article.appendChild(note);
        }

        container.appendChild(article);
    }
};
