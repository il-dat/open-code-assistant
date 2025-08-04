import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

export interface GenerateRequest {
    model: string;
    prompt: string;
    suffix?: string;
    options?: {
        temperature?: number;
        top_p?: number;
        num_predict?: number;
        stop?: string[];
    };
    stream?: boolean;
}

export interface GenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

export interface Model {
    name: string;
    modified_at: string;
    size: number;
    digest: string;
}

export interface ListModelsResponse {
    models: Model[];
}

export class OllamaClient {
    private axiosInstance: AxiosInstance;
    private baseUrl: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('ollama');
        this.baseUrl = config.get<string>('codeCompletion.providerUrl', 'http://localhost:11434');
        const authToken = config.get<string>('api.authToken', '');

        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
            timeout: 30000,
        });
    }

    async generate(request: GenerateRequest): Promise<GenerateResponse> {
        try {
            const response = await this.axiosInstance.post<GenerateResponse>(
                '/api/generate',
                { ...request, stream: false }
            );
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    throw new Error('Ollama service is not running. Please start Ollama first.');
                }
                throw new Error(`Ollama API error: ${error.message}`);
            }
            throw error;
        }
    }

    async *generateStream(request: GenerateRequest): AsyncGenerator<GenerateResponse> {
        try {
            const response = await this.axiosInstance.post(
                '/api/generate',
                { ...request, stream: true },
                { responseType: 'stream' }
            );

            const stream = response.data;
            let buffer = '';

            for await (const chunk of stream) {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const parsed = JSON.parse(line) as GenerateResponse;
                            yield parsed;
                        } catch (e) {
                            console.error('Failed to parse stream response:', e);
                        }
                    }
                }
            }

            if (buffer.trim()) {
                try {
                    const parsed = JSON.parse(buffer) as GenerateResponse;
                    yield parsed;
                } catch (e) {
                    console.error('Failed to parse final buffer:', e);
                }
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    throw new Error('Ollama service is not running. Please start Ollama first.');
                }
                throw new Error(`Ollama API error: ${error.message}`);
            }
            throw error;
        }
    }

    async listModels(): Promise<Model[]> {
        try {
            const response = await this.axiosInstance.get<ListModelsResponse>('/api/tags');
            return response.data.models || [];
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    throw new Error('Ollama service is not running. Please start Ollama first.');
                }
                throw new Error(`Ollama API error: ${error.message}`);
            }
            throw error;
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            await this.axiosInstance.get('/');
            return true;
        } catch (error) {
            return false;
        }
    }

    updateConfiguration(): void {
        const config = vscode.workspace.getConfiguration('ollama');
        this.baseUrl = config.get<string>('codeCompletion.providerUrl', 'http://localhost:11434');
        const authToken = config.get<string>('api.authToken', '');

        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
            timeout: 30000,
        });
    }
}