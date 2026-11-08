// Third Party
import { describe, expect, it } from 'vitest';

// AA bpforge
import { imageServer } from '@/Utils/eveOnline';

describe('eveOnline utils', () => {
    describe('imageServer', () => {
        it('should return correct URL for characters', () => {
            // Test Data
            const id = 98000001;

            // Test Action
            const url = imageServer('characters', id, 256);

            // Expected Result
            expect(url).toBe('https://images.evetech.net/characters/98000001/portrait?size=256');
        });

        it('should return correct URL for corporations', () => {
            // Test Data
            const id = 1000125;

            // Test Action
            const url = imageServer('corporations', id, 128);

            // Expected Result
            expect(url).toBe('https://images.evetech.net/corporations/1000125/logo?size=128');
        });

        it('should return correct URL for alliances', () => {
            // Test Data
            const id = 99000001;

            // Test Action
            const url = imageServer('alliances', id, 128);

            // Expected Result
            expect(url).toBe('https://images.evetech.net/alliances/99000001/logo?size=128');
        });

        it('should return correct URL for bpo', () => {
            // Test Data
            const id = 688;

            // Test Action
            const url = imageServer('bpo', id, 64);

            // Expected Result
            expect(url).toBe('https://images.evetech.net/types/688/bp?size=64');
        });

        it('should return correct URL for bpc', () => {
            // Test Data
            const id = 688;

            // Test Action
            const url = imageServer('bpc', id, 64);

            // Expected Result
            expect(url).toBe('https://images.evetech.net/types/688/bpc?size=64');
        });

        it('should return correct URL for item', () => {
            // Test Data
            const id = 34;

            // Test Action
            const url = imageServer('item', id, 32);

            // Expected Result
            expect(url).toBe('https://images.evetech.net/types/34/icon?size=32');
        });

        it('should return correct URL for ship render', () => {
            // Test Data
            const id = 587;

            // Test Action
            const url = imageServer('render', id, 512);

            // Expected Result
            expect(url).toBe('https://images.evetech.net/types/587/render?size=512');
        });
    });
});
