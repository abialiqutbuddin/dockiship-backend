import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class LocationService {
    private readonly logger = new Logger(LocationService.name);
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(private readonly config: ConfigService) {
        this.baseUrl = this.config.get<string>('LOCATION_DETAILS_BASE_URL') || '';
        this.apiKey = this.config.get<string>('LOCATION_DETAILS_API_KEY') || '';
    }

    async lookup(zipCode: string, country?: string) {
        if (!this.baseUrl || !this.apiKey) {
            this.logger.warn('Missing Location API configuration');
            return null;
        }

        try {
            const params: any = {
                apikey: this.apiKey,
                codes: zipCode,
            };
            if (country) {
                params.country = country;
            }

            const url = `${this.baseUrl}/search`;
            const { data } = await axios.get(url, { params });

            // Structure: data.results[zipCode] = [ { city, state_code, ... } ]
            if (!data || !data.results || !data.results[zipCode]) {
                return null;
            }

            const results = data.results[zipCode];
            if (!Array.isArray(results) || results.length === 0) {
                return null;
            }

            const first = results[0];
            // Zipcodebase returns "state_code" for e.g. "NY", and "city" for "New York"
            return {
                city: first.city,
                state: first.state_code || first.state, // Prefer code (NY), fallback to name (New York)
                country: first.country_code,
            };

        } catch (error: any) {
            this.logger.error(`Location lookup failed for ${zipCode}`, error?.message || 'Unknown error');
            return null; // Fail gracefully
        }
    }
}
